import { redirect } from "next/navigation";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { createTutorBoard, listUserBoards } from "@/lib/server/boards/board-service";

export const dynamic = "force-dynamic";

export default async function CurrentBoardPage() {
  const user = await requireRolePage("/boards/current", "student");
  const recent = await listUserBoards(user, 1);
  const board = recent[0] ?? await createTutorBoard(user);
  redirect(`/boards/${encodeURIComponent(board.boardId)}`);
}
