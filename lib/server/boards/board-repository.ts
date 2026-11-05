export type StoredBoard = {
  userId: string;
  boardId: string;
  stateJson: string;
  snapshotDataUrl: string | null;
  eventVersion: number;
  lastMcpAt: number | null;
  updatedAt: number;
};

export type StoredTutorAction = {
  id: number;
  userId: string;
  boardId: string;
  actionJson: string;
  createdAt: number;
};

export type SaveBoardInput = {
  userId: string;
  boardId: string;
  stateJson: string;
  snapshotDataUrl: string | null;
};

export interface BoardRepository {
  readForUser(userId: string): Promise<StoredBoard | null>;
  saveForUser(input: SaveBoardInput): Promise<{ eventVersion: number; updatedAt: number; lastMcpAt: number | null }>;
  markTutorConnected(userId: string): Promise<number>;
  enqueueTutorAction(userId: string, boardId: string, action: unknown): Promise<number | null>;
  readTutorActions(userId: string, boardId: string, after: number): Promise<StoredTutorAction[]>;
}
