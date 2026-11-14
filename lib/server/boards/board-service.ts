import type { BoardRepository, SaveBoardInput } from "./board-repository";
import { getDb } from "@/db";
import { PostgresBoardRepository } from "./postgres-board-repository";
import { applyBoardCommands, type BoardActor, type BoardCommand } from "@/lib/domain/board/commands";
import type { BoardDocument } from "@/lib/domain/board/model";
import { createEmptyBoardDocument } from "@/lib/domain/board/model";
import type { Viewer } from "@/lib/server/auth/viewer";
import { requireStudent } from "@/lib/server/auth/policies";

let repository: BoardRepository | null = null;

export function getBoardRepository(): BoardRepository {
  repository ??= new PostgresBoardRepository(getDb());
  return repository;
}

export function setBoardRepositoryForTesting(value: BoardRepository | null) {
  repository = value;
}

export function readTutorBoard(viewer: Viewer, boardId?: string, includeSnapshot = false) {
  requireStudent(viewer);
  return getBoardRepository().readForUser(viewer.appUserId, boardId, includeSnapshot);
}

export function listUserBoards(viewer: Viewer, limit = 12) {
  requireStudent(viewer);
  return getBoardRepository().listForUser(viewer.appUserId, limit);
}

export function markBoardOpened(viewer: Viewer, boardId: string) {
  requireStudent(viewer);
  return getBoardRepository().markOpened(viewer.appUserId, boardId);
}

export function saveTutorBoard(viewer: Viewer, input: Omit<SaveBoardInput, "userId">) {
  requireStudent(viewer);
  return getBoardRepository().saveForUser({ ...input, userId: viewer.appUserId });
}

export function deleteEmptyTutorBoard(viewer: Viewer, boardId: string) {
  requireStudent(viewer);
  return getBoardRepository().deleteEmptyForUser(viewer.appUserId, boardId);
}

export async function createTutorBoard(viewer: Viewer, title = "Untitled board") {
  requireStudent(viewer);
  const boardId = crypto.randomUUID();
  const document = createEmptyBoardDocument(boardId);
  const result = await saveTutorBoard(viewer, {
    boardId,
    stateJson: JSON.stringify(document),
    snapshotDataUrl: null,
    title,
  });
  return { boardId, title, ...result };
}

export function markMcpConnected(viewer: Viewer, boardId?: string) {
  requireStudent(viewer);
  return getBoardRepository().markTutorConnected(viewer.appUserId, boardId);
}

export function enqueueTutorAction(viewer: Viewer, boardId: string, action: unknown) {
  requireStudent(viewer);
  return getBoardRepository().enqueueTutorAction(viewer.appUserId, boardId, action);
}

export function readTutorActions(viewer: Viewer, boardId: string, after: number) {
  requireStudent(viewer);
  return getBoardRepository().readTutorActions(viewer.appUserId, boardId, after);
}

export async function applyTutorBoardCommands(input: {
  viewer: Viewer;
  boardId: string;
  expectedVersion?: number;
  commands: BoardCommand[];
  actor: BoardActor;
}) {
  requireStudent(input.viewer);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stored = await getBoardRepository().readForUser(input.viewer.appUserId, input.boardId, false);
    if (!stored) throw new Error("BOARD_NOT_FOUND");
    if (input.expectedVersion !== undefined && input.expectedVersion !== stored.eventVersion) {
      throw new Error(`BOARD_VERSION_CONFLICT:${stored.eventVersion}`);
    }
    const current = JSON.parse(stored.stateJson) as BoardDocument;
    const next = applyBoardCommands(current, input.commands, input.actor);
    const result = await getBoardRepository().updateForUser({
      userId: input.viewer.appUserId,
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
