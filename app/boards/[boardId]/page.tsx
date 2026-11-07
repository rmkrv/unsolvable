import { notFound } from "next/navigation";
import TutorBoard from "@/components/tutor-board";
import { requireCurrentUser } from "@/lib/server/auth/current-user";
import { markBoardOpened, readTutorBoard } from "@/lib/server/boards/board-service";

export const dynamic = "force-dynamic";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const user = await requireCurrentUser(`/boards/${encodeURIComponent(boardId)}`);
  const board = await readTutorBoard(user.userId, boardId, false);
  if (!board) notFound();
  await markBoardOpened(user.userId, boardId);
  return <TutorBoard displayName={user.displayName} boardId={boardId} />;
}
