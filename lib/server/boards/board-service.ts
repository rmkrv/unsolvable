import type { BoardRepository, SaveBoardInput } from "./board-repository";
import { getDb } from "@/db";
import { PostgresBoardRepository } from "./postgres-board-repository";
import { applyBoardCommands, type BoardActor, type BoardCommand } from "@/lib/domain/board/commands";
import type { BoardDocument } from "@/lib/domain/board/model";
import { createEmptyBoardDocument } from "@/lib/domain/board/model";

let repository: BoardRepository | null = null;

export function getBoardRepository(): BoardRepository {
  repository ??= new PostgresBoardRepository(getDb());
  return repository;
}

export function setBoardRepositoryForTesting(value: BoardRepository | null) {
  repository = value;
}

export function readTutorBoard(userId: string, boardId?: string, includeSnapshot = false) {
  return getBoardRepository().readForUser(userId, boardId, includeSnapshot);
}

export function listUserBoards(userId: string, limit = 12) {
  return getBoardRepository().listForUser(userId, limit);
}

export function markBoardOpened(userId: string, boardId: string) {
  return getBoardRepository().markOpened(userId, boardId);
}

export function saveTutorBoard(input: SaveBoardInput) {
  return getBoardRepository().saveForUser(input);
}

export async function createTutorBoard(userId: string, title = "Untitled board") {
  const boardId = crypto.randomUUID();
  const document = createEmptyBoardDocument(boardId);
  const result = await saveTutorBoard({
    userId,
    boardId,
    stateJson: JSON.stringify(document),
    snapshotDataUrl: null,
    title,
  });
  return { boardId, title, ...result };
}

export function markMcpConnected(userId: string, boardId?: string) {
  return getBoardRepository().markTutorConnected(userId, boardId);
}

export function enqueueTutorAction(userId: string, boardId: string, action: unknown) {
  return getBoardRepository().enqueueTutorAction(userId, boardId, action);
}

export function readTutorActions(userId: string, boardId: string, after: number) {
  return getBoardRepository().readTutorActions(userId, boardId, after);
}

export async function applyTutorBoardCommands(input: {
  userId: string;
  boardId: string;
  expectedVersion?: number;
  commands: BoardCommand[];
  actor: BoardActor;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stored = await getBoardRepository().readForUser(input.userId, input.boardId, false);
    if (!stored) throw new Error("BOARD_NOT_FOUND");
    if (input.expectedVersion !== undefined && input.expectedVersion !== stored.eventVersion) {
      throw new Error(`BOARD_VERSION_CONFLICT:${stored.eventVersion}`);
    }
    const current = JSON.parse(stored.stateJson) as BoardDocument;
    const next = applyBoardCommands(current, input.commands, input.actor);
    const result = await getBoardRepository().updateForUser({
      userId: input.userId,
      boardId: input.boardId,
      expectedVersion: stored.eventVersion,
      stateJson: JSON.stringify(next),
      snapshotDataUrl: null,
    });
    if (result) return { ...result, document: next };
    if (input.expectedVersion !== undefined) throw new Error(`BOARD_VERSION_CONFLICT:${stored.eventVersion + 1}`);
  }
  throw new Error("BOARD_UPDATE_RETRY_EXHAUSTED");
}
