import { Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/server/auth/current-user";
import { getHomeInsights, getUserProfile } from "@/lib/server/users/user-service";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await requireCurrentUser("/friends");
  const [insights, profile] = await Promise.all([getHomeInsights(user), getUserProfile(user)]);
  return <AppShell user={user} active="friends" title="Friends"><main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 xl:px-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/42">Collaboration</p><h2 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em]">Study partners</h2><section className="card card-border mt-8 bg-base-100"><div className="card-body items-center py-14 text-center"><Users size={34} className="text-primary" /><h3 className="mt-3 text-xl font-semibold">{insights.friendCount ? `${insights.friendCount} connected ${insights.friendCount === 1 ? "friend" : "friends"}` : "Your study circle is empty"}</h3><p className="max-w-xl text-sm leading-6 text-base-content/55">{profile.isDiscoverable ? "Your profile is discoverable. Search and invitations are the next collaboration slice." : "Turn on profile discovery in Settings before other eligible learners can find you. Email addresses are never exposed."}</p>{insights.pendingRequestCount > 0 && <span className="badge badge-primary badge-soft mt-2">{insights.pendingRequestCount} pending requests</span>}</div></section></main></AppShell>;
}
