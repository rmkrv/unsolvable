import { and, asc, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { tutorActions, tutorBoards } from "@/db/schema";
import type { BoardRepository, SaveBoardInput, StoredBoard, StoredTutorAction } from "./board-repository";

export class D1BoardRepository implements BoardRepository {
  async readForUser(userId: string): Promise<StoredBoard | null> {
    const rows = await getDb().select().from(tutorBoards).where(eq(tutorBoards.userId, userId)).limit(1);
    return rows[0] ?? null;
  }

  async saveForUser(input: SaveBoardInput) {
    const previous = await this.readForUser(input.userId);
    const eventVersion = (previous?.eventVersion ?? 0) + 1;
    const updatedAt = Date.now();

    await getDb()
      .insert(tutorBoards)
      .values({ ...input, eventVersion, updatedAt, lastMcpAt: previous?.lastMcpAt ?? null })
      .onConflictDoUpdate({
        target: tutorBoards.userId,
        set: {
          boardId: input.boardId,
          stateJson: input.stateJson,
          snapshotDataUrl: input.snapshotDataUrl,
          eventVersion,
          updatedAt,
        },
      });

    return { eventVersion, updatedAt, lastMcpAt: previous?.lastMcpAt ?? null };
  }

  async markTutorConnected(userId: string) {
    const lastMcpAt = Date.now();
    await getDb().update(tutorBoards).set({ lastMcpAt }).where(eq(tutorBoards.userId, userId));
    return lastMcpAt;
  }

  async enqueueTutorAction(userId: string, boardId: string, action: unknown) {
    const rows = await getDb()
      .insert(tutorActions)
      .values({ userId, boardId, actionJson: JSON.stringify(action), createdAt: Date.now() })
      .returning({ id: tutorActions.id });
    return rows[0]?.id ?? null;
  }

  async readTutorActions(userId: string, boardId: string, after: number): Promise<StoredTutorAction[]> {
    return getDb()
      .select()
      .from(tutorActions)
      .where(
        and(
          eq(tutorActions.userId, userId),
          eq(tutorActions.boardId, boardId),
          gt(tutorActions.id, Math.max(0, after)),
        ),
      )
      .orderBy(asc(tutorActions.id))
      .limit(100);
  }
}
