"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewBoardButton({ className, href }: { className?: string; href?: string }) {
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

  if (href) {
    return <Button asChild className={className}><Link href={href}><Plus />New board</Link></Button>;
  }

  return (
    <>
      <Button type="button" className={className} onClick={createBoard} disabled={creating} title={error || undefined}>
        {creating ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Plus />}
        New board
      </Button>
      {error && <span className="sr-only" role="alert">{error}</span>}
    </>
  );
}
