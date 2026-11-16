import { LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BoardListCard } from "@/components/board/board-list-card";
import { NewBoardButton } from "@/components/new-board-button";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { loadUserBoards } from "@/lib/server/home/dashboard-data";

export const dynamic = "force-dynamic";

export default async function BoardsPage() {
  const user = await requireRolePage("/boards", "student");
  const boards = await loadUserBoards(user, 50);
  return (
    <AppShell user={user} active="boards" title="Boards">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 xl:px-12">
        <div className="flex items-end justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your workspace</p><h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Boards</h2></div>
          <NewBoardButton />
        </div>
        {boards.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => <BoardListCard
            key={board.boardId}
            boardId={board.boardId}
            title={board.title}
            subject={board.subject}
            eventVersion={board.eventVersion}
            lastOpenedLabel={new Date(board.lastOpenedAt).toLocaleDateString()}
          />)}
        </div> : <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center"><LayoutGrid className="mx-auto text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No boards yet</h3><p className="mt-2 text-sm text-muted-foreground">Create a board to begin a problem and keep its full working history.</p><div className="mt-5 flex justify-center"><NewBoardButton /></div></div>}
      </main>
    </AppShell>
  );
}
