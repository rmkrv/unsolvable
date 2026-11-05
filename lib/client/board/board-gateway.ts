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
  read(after: number): Promise<SharedBoardResponse>;
  save(document: BoardDocument, snapshotDataUrl?: string): Promise<{ eventVersion: number; updatedAt: number }>;
}

async function jsonOrError<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload;
}

export function createHttpBoardGateway(fetcher: typeof fetch = fetch): BoardGateway {
  return {
    async read(after) {
      const response = await fetcher(`/api/board?after=${after}`, { cache: "no-store" });
      return jsonOrError<SharedBoardResponse>(response, "Shared board unavailable");
    },
    async save(document, snapshotDataUrl) {
      const response = await fetcher("/api/board", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ boardId: document.boardId, state: document, snapshotDataUrl }),
      });
      return jsonOrError<{ eventVersion: number; updatedAt: number }>(response, "Could not sync the shared board.");
    },
  };
}
