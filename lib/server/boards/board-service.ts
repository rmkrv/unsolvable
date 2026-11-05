import type { BoardRepository, SaveBoardInput } from "./board-repository";
import { D1BoardRepository } from "./d1-board-repository";

let repository: BoardRepository | null = null;

export function getBoardRepository(): BoardRepository {
  repository ??= new D1BoardRepository();
  return repository;
}

export function setBoardRepositoryForTesting(value: BoardRepository | null) {
  repository = value;
}

export function readTutorBoard(userId: string) {
  return getBoardRepository().readForUser(userId);
}

export function saveTutorBoard(input: SaveBoardInput) {
  return getBoardRepository().saveForUser(input);
}

export function markMcpConnected(userId: string) {
  return getBoardRepository().markTutorConnected(userId);
}

export function enqueueTutorAction(userId: string, boardId: string, action: unknown) {
  return getBoardRepository().enqueueTutorAction(userId, boardId, action);
}

export function readTutorActions(userId: string, boardId: string, after: number) {
  return getBoardRepository().readTutorActions(userId, boardId, after);
}
