import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  appUsers,
  boardMembers,
  boards,
  tutorActions,
  workspaceMembers,
  workspaces,
} from "../../../db/schema.ts";
import type { BoardRepository, SaveBoardInput, StoredBoard, StoredTutorAction, UpdateBoardInput } from "./board-repository";

type PersonalContext = { userId: string; workspaceId: string };
type AuthorizedBoard = { id: string; externalId: string; role: string };
type Database = ReturnType<typeof getDb>;

export class PostgresBoardRepository implements BoardRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async readForUser(authSubject: string, boardId?: string, includeSnapshot = false): Promise<StoredBoard | null> {
    const filters = [eq(appUsers.authSubject, authSubject)];
    if (boardId) filters.push(eq(boards.externalId, boardId));
    const rows = await this.db
      .select({
        id: boards.id,
        externalId: boards.externalId,
        state: boards.state,
        snapshotDataUrl: includeSnapshot ? boards.snapshotDataUrl : sql<string | null>`null`,
        eventVersion: boards.eventVersion,
        lastMcpAt: boards.lastMcpAt,
        updatedAt: boards.updatedAt,
      })
      .from(appUsers)
      .innerJoin(boardMembers, eq(boardMembers.userId, appUsers.id))
      .innerJoin(boards, eq(boards.id, boardMembers.boardId))
      .where(and(...filters))
      .orderBy(desc(boards.updatedAt))
      .limit(1);

    return rows[0] ? toStoredBoard(authSubject, rows[0]) : null;
  }

  async saveForUser(input: SaveBoardInput) {
    if (input.expectedVersion !== undefined) {
      const updated = await this.updateForUser({ ...input, expectedVersion: input.expectedVersion });
      if (updated) return updated;
      const current = await this.readForUser(input.userId, input.boardId, false);
      throw new Error(`BOARD_VERSION_CONFLICT:${current?.eventVersion ?? 0}`);
    }
    const context = await ensurePersonalContext(this.db, input.userId);
    const now = new Date();
    const state = JSON.parse(input.stateJson) as unknown;
    const rows = await this.db
      .insert(boards)
      .values({
        workspaceId: context.workspaceId,
        externalId: input.boardId,
        state,
        snapshotDataUrl: input.snapshotDataUrl,
        eventVersion: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [boards.workspaceId, boards.externalId],
        set: {
          state,
          snapshotDataUrl: input.snapshotDataUrl,
          eventVersion: sql`${boards.eventVersion} + 1`,
          updatedAt: now,
        },
      })
      .returning({
        id: boards.id,
        eventVersion: boards.eventVersion,
        updatedAt: boards.updatedAt,
        lastMcpAt: boards.lastMcpAt,
      });

    const board = rows[0];
    if (!board) throw new Error("BOARD_SAVE_FAILED");

    await this.db
      .insert(boardMembers)
      .values({ boardId: board.id, userId: context.userId, role: "owner" })
      .onConflictDoNothing();

    return {
      eventVersion: board.eventVersion,
      updatedAt: board.updatedAt.getTime(),
      lastMcpAt: board.lastMcpAt?.getTime() ?? null,
    };
  }

  async updateForUser(input: UpdateBoardInput) {
    const board = await findAuthorizedBoard(this.db, input.userId, input.boardId);
    if (!board || !canEdit(board.role)) return null;
    const now = new Date();
    const rows = await this.db
      .update(boards)
      .set({
        state: JSON.parse(input.stateJson) as unknown,
        snapshotDataUrl: input.snapshotDataUrl,
        eventVersion: sql`${boards.eventVersion} + 1`,
        updatedAt: now,
      })
      .where(and(eq(boards.id, board.id), eq(boards.eventVersion, input.expectedVersion)))
      .returning({
        eventVersion: boards.eventVersion,
        updatedAt: boards.updatedAt,
        lastMcpAt: boards.lastMcpAt,
      });
    const updated = rows[0];
    return updated
      ? {
          eventVersion: updated.eventVersion,
          updatedAt: updated.updatedAt.getTime(),
          lastMcpAt: updated.lastMcpAt?.getTime() ?? null,
        }
      : null;
  }

  async markTutorConnected(authSubject: string, boardId?: string): Promise<number> {
    const board = await findAuthorizedBoard(this.db, authSubject, boardId);
    const lastMcpAt = new Date();
    if (board) {
      await this.db.update(boards).set({ lastMcpAt }).where(eq(boards.id, board.id));
    }
    return lastMcpAt.getTime();
  }

  async enqueueTutorAction(authSubject: string, boardId: string, action: unknown): Promise<number | null> {
    const [board, user] = await Promise.all([
      findAuthorizedBoard(this.db, authSubject, boardId),
      findAppUser(this.db, authSubject),
    ]);
    if (!board || !user || !canEdit(board.role)) return null;

    const rows = await this.db
      .insert(tutorActions)
      .values({ boardId: board.id, userId: user.id, action })
      .returning({ id: tutorActions.id });
    return rows[0]?.id ?? null;
  }

  async readTutorActions(
    authSubject: string,
    boardId: string,
    after: number,
  ): Promise<StoredTutorAction[]> {
    const board = await findAuthorizedBoard(this.db, authSubject, boardId);
    if (!board) return [];

    const rows = await this.db
      .select()
      .from(tutorActions)
      .where(and(eq(tutorActions.boardId, board.id), gt(tutorActions.id, Math.max(0, after))))
      .orderBy(asc(tutorActions.id))
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      userId: authSubject,
      boardId: board.externalId,
      actionJson: JSON.stringify(row.action),
      createdAt: row.createdAt.getTime(),
    }));
  }
}

async function ensurePersonalContext(db: Database, authSubject: string): Promise<PersonalContext> {
  const now = new Date();
  const userRows = await db
    .insert(appUsers)
    .values({ authSubject, updatedAt: now })
    .onConflictDoUpdate({ target: appUsers.authSubject, set: { updatedAt: now } })
    .returning({ id: appUsers.id });
  const user = userRows[0];
  if (!user) throw new Error("USER_PROVISION_FAILED");

  const workspaceRows = await db
    .insert(workspaces)
    .values({ name: "Personal", personalOwnerId: user.id, updatedAt: now })
    .onConflictDoUpdate({ target: workspaces.personalOwnerId, set: { updatedAt: now } })
    .returning({ id: workspaces.id });
  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("WORKSPACE_PROVISION_FAILED");

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId: user.id, role: "owner" })
    .onConflictDoNothing();

  return { userId: user.id, workspaceId: workspace.id };
}

async function findAppUser(db: Database, authSubject: string) {
  const rows = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.authSubject, authSubject))
    .limit(1);
  return rows[0] ?? null;
}

async function findAuthorizedBoard(
  db: Database,
  authSubject: string,
  externalId?: string,
): Promise<AuthorizedBoard | null> {
  const filters = [eq(appUsers.authSubject, authSubject)];
  if (externalId) filters.push(eq(boards.externalId, externalId));

  const rows = await db
    .select({ id: boards.id, externalId: boards.externalId, role: boardMembers.role })
    .from(appUsers)
    .innerJoin(boardMembers, eq(boardMembers.userId, appUsers.id))
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .where(and(...filters))
    .orderBy(desc(boards.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

function toStoredBoard(
  authSubject: string,
  board: Pick<
    typeof boards.$inferSelect,
    "externalId" | "state" | "snapshotDataUrl" | "eventVersion" | "lastMcpAt" | "updatedAt"
  >,
): StoredBoard {
  return {
    userId: authSubject,
    boardId: board.externalId,
    stateJson: JSON.stringify(board.state),
    snapshotDataUrl: board.snapshotDataUrl,
    eventVersion: board.eventVersion,
    lastMcpAt: board.lastMcpAt?.getTime() ?? null,
    updatedAt: board.updatedAt.getTime(),
  };
}

function canEdit(role: string) {
  return role === "owner" || role === "editor";
}
