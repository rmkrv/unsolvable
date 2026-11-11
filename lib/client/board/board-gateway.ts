import type { BoardDocument, Page } from "@/lib/domain/board/model";
import type { BoardAction } from "@/lib/domain/tutor/board-action";

export type BoardSaveResult = { eventVersion: number; updatedAt: number };
export type BoardSaveDraft = {
  document: BoardDocument;
  snapshotDataUrl?: string;
  title?: string;
};
export type BoardSaveRequest = BoardSaveDraft & { expectedVersion: number };

export class BoardGatewayError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "BoardGatewayError";
    this.status = status;
    this.code = code;
  }
}

export type SharedBoardResponse = {
  board: {
    boardId: string;
    title: string;
    state?: Partial<BoardDocument> & { pages?: Page[] };
    eventVersion: number;
    lastMcpAt: number | null;
    updatedAt: number;
  } | null;
  actions: Array<{ id: number; value: BoardAction }>;
};

export type BoardListItem = {
  boardId: string;
  title: string;
  subject: string | null;
  eventVersion: number;
  lastOpenedAt: number;
  updatedAt: number;
};

export interface BoardGateway {
  list(limit?: number): Promise<BoardListItem[]>;
  read(boardId: string, after: number, options?: { includeBoard?: boolean }): Promise<SharedBoardResponse>;
  save(request: BoardSaveRequest): Promise<BoardSaveResult>;
  deleteIfEmpty(boardId: string, options?: { keepalive?: boolean }): Promise<boolean>;
}

async function jsonOrError<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json() as T & { error?: string | { code?: string; message?: string } };
  const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
  const code = typeof payload.error === "object" ? payload.error?.code : undefined;
  if (!response.ok) throw new BoardGatewayError(message || fallback, response.status, code);
  return payload;
}

export function createHttpBoardGateway(fetcher: typeof fetch = fetch): BoardGateway {
  return {
    async list(limit = 12) {
      const params = new URLSearchParams({ limit: String(Math.max(1, Math.min(50, limit))) });
      const response = await fetcher(`/api/student/boards?${params}`, { cache: "no-store" });
      const payload = await jsonOrError<{ boards: BoardListItem[] }>(response, "Could not list boards.");
      return payload.boards;
    },
    async read(boardId, after, { includeBoard = true } = {}) {
      const params = new URLSearchParams({ boardId, after: String(after) });
      const boardRequest = includeBoard
        ? fetcher(`/api/student/boards/${encodeURIComponent(boardId)}`, { cache: "no-store" })
            .then((response) => jsonOrError<{ board: SharedBoardResponse["board"] }>(response, "Shared board unavailable"))
        : Promise.resolve({ board: null });
      const actionsRequest = fetcher(`/api/student/boards/${encodeURIComponent(boardId)}/actions?${params}`, { cache: "no-store" })
        .then((response) => jsonOrError<{ actions: SharedBoardResponse["actions"] }>(response, "Board actions unavailable"));
      const [boardPayload, actionsPayload] = await Promise.all([boardRequest, actionsRequest]);
      return { board: boardPayload.board, actions: actionsPayload.actions };
    },
    async save({ document, snapshotDataUrl, expectedVersion, title }) {
      const response = await fetcher(`/api/student/boards/${encodeURIComponent(document.boardId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: document, snapshotDataUrl: snapshotDataUrl ?? null, expectedVersion, title }),
      });
      return jsonOrError<{ eventVersion: number; updatedAt: number }>(response, "Could not sync the shared board.");
    },
    async deleteIfEmpty(boardId, { keepalive = false } = {}) {
      const response = await fetcher(`/api/student/boards/${encodeURIComponent(boardId)}`, {
        method: "DELETE",
        keepalive,
      });
      const payload = await jsonOrError<{ deleted: boolean }>(response, "Could not clean up the empty board.");
      return payload.deleted;
    },
  };
}
