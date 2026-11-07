import TutorBoard from "@/components/tutor-board";
import { requireCurrentUser } from "@/lib/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function CurrentBoardPage() {
  const user = await requireCurrentUser("/boards/current");
  return <TutorBoard displayName={user.displayName} />;
}
