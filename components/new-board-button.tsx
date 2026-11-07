"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function NewBoardButton({ className = "btn" }: { className?: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createBoard() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json() as { board?: { boardId: string }; error?: string };
      if (!response.ok || !payload.board) throw new Error(payload.error || "Could not create a board.");
      router.push(`/boards/${encodeURIComponent(payload.board.boardId)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a board.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={createBoard} disabled={creating} title={error || undefined}>
        {creating ? <span className="loading loading-spinner loading-xs" /> : <Plus size={17} />}
        New board
      </button>
      {error && <span className="sr-only" role="alert">{error}</span>}
    </>
  );
}
