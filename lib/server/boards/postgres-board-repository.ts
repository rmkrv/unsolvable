import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  boardMembers,
  boards,
  tutorActions,
  userBoardActivity,
  workspaceMembers,
  workspaces,
} from "../../../db/schema.ts";
import type { BoardRepository, BoardSummary, SaveBoardInput, StoredBoard, StoredTutorAction, UpdateBoardInput } from "./board-repository";

type PersonalContext = { userId: string; workspaceId: string };
type AuthorizedBoard = { id: string; externalId: string; role: string; eventVersion: number };
type Database = ReturnType<typeof getDb>;

export class PostgresBoardRepository implements BoardRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async readForUser(userId: string, boardId?: string, includeSnapshot = false): Promise<StoredBoard | null> {
    const filters = [eq(boardMembers.userId, userId)];
    if (boardId) filters.push(eq(boards.externalId, boardId));
    const rows = await this.db
      .select({
        id: boards.id,
        externalId: boards.externalId,
        title: boards.title,
        state: boards.state,
        snapshotDataUrl: includeSnapshot ? boards.snapshotDataUrl : sql<string | null>`null`,
        eventVersion: boards.eventVersion,
        lastMcpAt: boards.lastMcpAt,
        updatedAt: boards.updatedAt,
      })
      .from(boardMembers)
      .innerJoin(boards, eq(boards.id, boardMembers.boardId))
      .where(and(...filters))
      .orderBy(desc(boards.updatedAt))
      .limit(1);

    return rows[0] ? toStoredBoard(userId, rows[0]) : null;
  }

  async listForUser(userId: string, limit = 12): Promise<BoardSummary[]> {
    const rows = await this.db
      .select({
        boardId: boards.externalId,
        title: boards.title,
        subject: boards.subject,
        eventVersion: boards.eventVersion,
        lastOpenedAt: userBoardActivity.lastOpenedAt,
        updatedAt: boards.updatedAt,
      })
      .from(boardMembers)
      .innerJoin(boards, eq(boards.id, boardMembers.boardId))
      .leftJoin(
        userBoardActivity,
        and(eq(userBoardActivity.userId, userId), eq(userBoardActivity.boardId, boards.id)),
      )
      .where(eq(boardMembers.userId, userId))
      .orderBy(desc(sql`coalesce(${userBoardActivity.lastOpenedAt}, ${boards.updatedAt})`))
      .limit(Math.max(1, Math.min(50, limit)));

    return rows.map((row) => ({
      boardId: row.boardId,
      title: row.title,
      subject: row.subject,
      eventVersion: row.eventVersion,
      lastOpenedAt: (row.lastOpenedAt ?? row.updatedAt).getTime(),
      updatedAt: row.updatedAt.getTime(),
    }));
  }

  async markOpened(userId: string, boardId: string): Promise<boolean> {
    const board = await findAuthorizedBoard(this.db, userId, boardId);
    if (!board) return false;
    const lastOpenedAt = new Date();
    await this.db
      .insert(userBoardActivity)
      .values({
        userId,
        boardId: board.id,
        lastOpenedAt,
        lastViewedEventVersion: board.eventVersion,
      })
      .onConflictDoUpdate({
        target: [userBoardActivity.userId, userBoardActivity.boardId],
        set: { lastOpenedAt, lastViewedEventVersion: board.eventVersion },
      });
    return true;
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
        title: input.title?.trim().slice(0, 120) || "Untitled board",
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

    await this.db
      .insert(userBoardActivity)
      .values({
        boardId: board.id,
        userId: context.userId,
        lastOpenedAt: now,
        lastViewedEventVersion: board.eventVersion,
      })
      .onConflictDoUpdate({
        target: [userBoardActivity.userId, userBoardActivity.boardId],
        set: { lastOpenedAt: now, lastViewedEventVersion: board.eventVersion },
      });

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
        ...(input.title === undefined
          ? {}
          : { title: input.title.trim().slice(0, 120) || "Untitled board" }),
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

  async markTutorConnected(userId: string, boardId?: string): Promise<number> {
    const board = await findAuthorizedBoard(this.db, userId, boardId);
    const lastMcpAt = new Date();
    if (board) {
      await this.db.update(boards).set({ lastMcpAt }).where(eq(boards.id, board.id));
    }
    return lastMcpAt.getTime();
  }

  async enqueueTutorAction(userId: string, boardId: string, action: unknown): Promise<number | null> {
    const board = await findAuthorizedBoard(this.db, userId, boardId);
    if (!board || !canEdit(board.role)) return null;

    const rows = await this.db
      .insert(tutorActions)
      .values({ boardId: board.id, userId, action })
      .returning({ id: tutorActions.id });
    return rows[0]?.id ?? null;
  }

  async readTutorActions(
    userId: string,
    boardId: string,
    after: number,
  ): Promise<StoredTutorAction[]> {
    const board = await findAuthorizedBoard(this.db, userId, boardId);
    if (!board) return [];

    const rows = await this.db
      .select()
      .from(tutorActions)
      .where(and(eq(tutorActions.boardId, board.id), gt(tutorActions.id, Math.max(0, after))))
      .orderBy(asc(tutorActions.id))
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      userId,
      boardId: board.externalId,
      actionJson: JSON.stringify(row.action),
      createdAt: row.createdAt.getTime(),
    }));
  }
}

async function ensurePersonalContext(db: Database, userId: string): Promise<PersonalContext> {
  const now = new Date();
  const workspaceRows = await db
    .insert(workspaces)
    .values({ name: "Personal", personalOwnerId: userId, updatedAt: now })
    .onConflictDoUpdate({ target: workspaces.personalOwnerId, set: { updatedAt: now } })
    .returning({ id: workspaces.id });
  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("WORKSPACE_PROVISION_FAILED");

  await db
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId, role: "owner" })
    .onConflictDoNothing();

  return { userId, workspaceId: workspace.id };
}

async function findAuthorizedBoard(
  db: Database,
  userId: string,
  externalId?: string,
): Promise<AuthorizedBoard | null> {
  const filters = [eq(boardMembers.userId, userId)];
  if (externalId) filters.push(eq(boards.externalId, externalId));

  const rows = await db
    .select({
      id: boards.id,
      externalId: boards.externalId,
      role: boardMembers.role,
      eventVersion: boards.eventVersion,
    })
    .from(boardMembers)
    .innerJoin(boards, eq(boards.id, boardMembers.boardId))
    .where(and(...filters))
    .orderBy(desc(boards.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

function toStoredBoard(
  userId: string,
  board: Pick<
    typeof boards.$inferSelect,
    "externalId" | "title" | "state" | "snapshotDataUrl" | "eventVersion" | "lastMcpAt" | "updatedAt"
  >,
): StoredBoard {
  return {
    userId,
    boardId: board.externalId,
    title: board.title,
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
