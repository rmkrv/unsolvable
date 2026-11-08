import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/server/auth/current-user";
import { createTutorBoard, listUserBoards } from "@/lib/server/boards/board-service";

export const dynamic = "force-dynamic";

export default async function CurrentBoardPage() {
  const user = await requireCurrentUser("/boards/current");
  const recent = await listUserBoards(user.userId, 1);
  const board = recent[0] ?? await createTutorBoard(user.userId);
  redirect(`/boards/${encodeURIComponent(board.boardId)}`);
}
