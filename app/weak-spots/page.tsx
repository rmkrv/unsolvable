import { Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/lib/server/auth/current-user";
import { loadHomeOverview } from "@/lib/server/home/dashboard-data";

export const dynamic = "force-dynamic";

export default async function WeakSpotsPage() {
  const user = await requireCurrentUser("/weak-spots");
  const { insights: { weakSpot } } = await loadHomeOverview(user.userId, user.fullName || user.displayName);
  return <AppShell user={user} active="weak-spots" title="Weak spots"><main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 xl:px-12"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Learning evidence</p><h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Find your weak spots</h2>{weakSpot ? <section className="card card-border mt-8 bg-base-100"><div className="card-body"><div className="flex items-center gap-3"><Target className="text-warning" /><h3 className="card-title">{weakSpot.skillName}</h3></div><div className="stats mt-4 bg-base-200"><div className="stat"><div className="stat-title">Mastery estimate</div><div className="stat-value">{weakSpot.score}%</div><div className="stat-desc">{weakSpot.evidenceCount} evidence points · {weakSpot.confidence}% confidence</div></div></div><progress className="progress progress-warning mt-3" value={weakSpot.score} max="100" /><p className="mt-3 text-sm text-base-content/55">This estimate changes as new practice evidence is recorded.</p></div></section> : <section className="card card-border mt-8 bg-base-100"><div className="card-body items-center py-14 text-center"><Target size={34} className="text-warning" /><h3 className="mt-3 text-xl font-semibold">Not enough evidence yet</h3><p className="max-w-xl text-sm leading-6 text-base-content/55">Weak spots appear only after practice attempts produce evidence. The backend is ready; scoring starts when the diagnostic flow records its first attempts.</p></div></section>}</main></AppShell>;
}
