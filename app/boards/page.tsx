import Link from "next/link";
import { ArrowRight, Clock3, LayoutGrid } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
          {boards.map((board) => <Link key={board.boardId} href={`/boards/${encodeURIComponent(board.boardId)}`} className="card card-border bg-base-100 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="card-body"><div className="flex items-center justify-between"><LayoutGrid size={20} className="text-primary" /><span className="badge badge-outline badge-sm">v{board.eventVersion}</span></div><h3 className="card-title mt-3">{board.title}</h3><p className="text-sm text-base-content/50">{board.subject || "Mathematics"}</p><div className="mt-5 flex items-center justify-between text-xs text-base-content/45"><span className="flex items-center gap-1.5"><Clock3 size={14} />{new Date(board.lastOpenedAt).toLocaleDateString()}</span><ArrowRight size={16} /></div></div>
          </Link>)}
        </div> : <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center"><LayoutGrid className="mx-auto text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">No boards yet</h3><p className="mt-2 text-sm text-muted-foreground">Create a board to begin a problem and keep its full working history.</p><div className="mt-5 flex justify-center"><NewBoardButton /></div></div>}
      </main>
    </AppShell>
  );
}
