import type { BoardDocument, Page } from "@/lib/domain/board/model";
import type { BoardAction } from "@/lib/domain/tutor/board-action";

export type SharedBoardResponse = {
  board: {
    boardId: string;
    state?: Partial<BoardDocument> & { pages?: Page[] };
    eventVersion: number;
    lastMcpAt: number | null;
    updatedAt: number;
  } | null;
  actions: Array<{ id: number; value: BoardAction }>;
};

export interface BoardGateway {
  read(boardId: string, after: number): Promise<SharedBoardResponse>;
  save(document: BoardDocument, snapshotDataUrl?: string, expectedVersion?: number): Promise<{ eventVersion: number; updatedAt: number }>;
}

async function jsonOrError<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json() as T & { error?: string | { message?: string } };
  const message = typeof payload.error === "string" ? payload.error : payload.error?.message;
  if (!response.ok) throw new Error(message || fallback);
  return payload;
}

export function createHttpBoardGateway(fetcher: typeof fetch = fetch): BoardGateway {
  return {
    async read(boardId, after) {
      const params = new URLSearchParams({ boardId, after: String(after) });
      const boardResponse = await fetcher(`/api/student/boards/${encodeURIComponent(boardId)}`, { cache: "no-store" });
      const boardPayload = await jsonOrError<{ board: SharedBoardResponse["board"] }>(boardResponse, "Shared board unavailable");
      const actionsResponse = await fetcher(`/api/student/boards/${encodeURIComponent(boardId)}/actions?${params}`, { cache: "no-store" });
      const actionsPayload = await jsonOrError<{ actions: SharedBoardResponse["actions"] }>(actionsResponse, "Board actions unavailable");
      return { board: boardPayload.board, actions: actionsPayload.actions };
    },
    async save(document, snapshotDataUrl, expectedVersion) {
      const response = await fetcher(`/api/student/boards/${encodeURIComponent(document.boardId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: document, snapshotDataUrl: snapshotDataUrl ?? null, expectedVersion }),
      });
      return jsonOrError<{ eventVersion: number; updatedAt: number }>(response, "Could not sync the shared board.");
    },
  };
}
