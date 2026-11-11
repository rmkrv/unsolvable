import { notFound } from "next/navigation";
import TutorBoard from "@/components/tutor-board";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { markBoardOpened, readTutorBoard } from "@/lib/server/boards/board-service";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const user = await requireRolePage(`/boards/${encodeURIComponent(boardId)}`, "student");
  const [board] = await Promise.all([
    readTutorBoard(user, boardId, false),
    markBoardOpened(user, boardId),
  ]);
  if (!board) notFound();
  return <TutorBoard displayName={user.displayName} boardId={boardId} initialTitle={board.title} />;
}
