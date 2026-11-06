import TutorBoard from "@/components/tutor-board";
import { requireCurrentUser } from "@/lib/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireCurrentUser("/");
  return <TutorBoard displayName={user.displayName} />;
}
