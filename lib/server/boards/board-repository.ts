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
  expectedVersion?: number;
};

export type UpdateBoardInput = SaveBoardInput & { expectedVersion: number };

export interface BoardRepository {
  readForUser(userId: string, boardId?: string, includeSnapshot?: boolean): Promise<StoredBoard | null>;
  saveForUser(input: SaveBoardInput): Promise<{ eventVersion: number; updatedAt: number; lastMcpAt: number | null }>;
  updateForUser(input: UpdateBoardInput): Promise<{ eventVersion: number; updatedAt: number; lastMcpAt: number | null } | null>;
  markTutorConnected(userId: string, boardId?: string): Promise<number>;
  enqueueTutorAction(userId: string, boardId: string, action: unknown): Promise<number | null>;
  readTutorActions(userId: string, boardId: string, after: number): Promise<StoredTutorAction[]>;
}
