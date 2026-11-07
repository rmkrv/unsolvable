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
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}

export function createHttpBoardGateway(fetcher: typeof fetch = fetch): BoardGateway {
  return {
    async read(boardId, after) {
      const params = new URLSearchParams({ boardId, after: String(after) });
      const response = await fetcher(`/api/board?${params}`, { cache: "no-store" });
      return jsonOrError<SharedBoardResponse>(response, "Shared board unavailable");
    },
    async save(document, snapshotDataUrl, expectedVersion) {
      const response = await fetcher("/api/board", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId: document.boardId, state: document, snapshotDataUrl, expectedVersion }),
      });
      return jsonOrError<{ eventVersion: number; updatedAt: number }>(response, "Could not sync the shared board.");
    },
  };
}
