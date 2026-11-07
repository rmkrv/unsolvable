import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Clock3,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireCurrentUser, type AuthenticatedUser } from "@/lib/server/auth/current-user";

export const dynamic = "force-dynamic";

const recentBoards = [
  { title: "Limits and continuity", subject: "Calculus", time: "12 minutes ago", mark: "lim x→2", tone: "bg-primary/10 text-primary" },
  { title: "Quadratic transformations", subject: "Algebra", time: "Yesterday", mark: "f(x−3)", tone: "bg-warning/10 text-warning" },
  { title: "Forces on an incline", subject: "Mechanics", time: "4 days ago", mark: "ΣF = ma", tone: "bg-success/10 text-success" },
];

export function HomeDashboard({ user }: { user: AuthenticatedUser }) {
  const firstName = (user.fullName || user.displayName).split(/[\s@]/)[0];

  return (
    <AppShell user={user} active="home" title="Home">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 xl:px-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/42">Saturday, 7 November</p>
              <span className="badge badge-outline badge-sm">Design preview</span>
            </div>
            <h2 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Good to see you, {firstName}.</h2>
            <p className="mt-3 text-base text-base-content/58">Pick up the thread, or start with the idea that needs attention.</p>
          </div>
          <Link href="/boards/current" className="btn hidden sm:inline-flex"><Plus size={17} /> New board</Link>
        </div>

        <section className="mt-9 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <article className="card overflow-hidden bg-neutral text-neutral-content shadow-xl shadow-neutral/10">
            <div className="card-body min-h-[330px] justify-between p-7 sm:p-9">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <span className="badge border-white/15 bg-white/8 text-white/75">Continue practice</span>
                  <h3 className="mt-5 max-w-2xl font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">The limit exists. Your factorization needs one repair.</h3>
                  <p className="mt-4 max-w-xl leading-7 text-neutral-content/62">Resume the board at the first uncertain step. Your earlier pages and tutor context are still there.</p>
                </div>
                <div className="hidden size-16 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 sm:flex"><Sparkles size={26} /></div>
              </div>
              <div className="card-actions mt-8 items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-neutral-content/52"><Clock3 size={14} /> Last opened 12 minutes ago</div>
                <Link href="/boards/current" className="btn btn-primary">Continue board <ArrowRight size={17} /></Link>
              </div>
            </div>
          </article>

          <article id="weak-spots" className="card card-border bg-base-100">
            <div className="card-body p-6 sm:p-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-box bg-warning/12 text-warning"><Target size={20} /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/40">Weak spot</p><h3 className="font-semibold">Factoring structure</h3></div></div>
                <span className="badge badge-warning badge-soft badge-sm">Medium confidence</span>
              </div>
              <div className="mt-7 rounded-box bg-base-200 p-5">
                <div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold tracking-tight">58%</p><p className="mt-1 text-xs text-base-content/48">mastery estimate</p></div><p className="text-right text-xs leading-5 text-base-content/48">3 recent attempts<br />2 similar slips</p></div>
                <progress className="progress progress-warning mt-4 h-2" value="58" max="100" />
              </div>
              <p className="mt-5 text-sm leading-6 text-base-content/58">You recognize the method, but signs and factor pairs are still costing you the next step.</p>
              <div className="card-actions mt-2 justify-end"><button className="btn btn-ghost btn-sm" type="button">See evidence <ArrowRight size={15} /></button></div>
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <article id="friends" className="card card-border bg-base-100">
            <div className="card-body p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/40">Study together</p><h3 className="card-title mt-1">Friends</h3></div><Users className="text-base-content/35" size={22} /></div>
              <div className="mt-5 flex items-center">
                <div className="avatar-group -space-x-3">
                  {["MK", "JP", "AS"].map((name, index) => <div className="avatar avatar-placeholder" key={name}><div className={`flex size-10 items-center justify-center rounded-full border-2 border-base-100 text-xs font-bold ${index === 0 ? "bg-primary text-primary-content" : index === 1 ? "bg-neutral text-neutral-content" : "bg-warning text-warning-content"}`}>{name}</div></div>)}
                </div>
                <div className="ml-4"><p className="text-sm font-semibold">3 people studying now</p><p className="mt-0.5 text-xs text-base-content/48">Calculus, algebra, mechanics</p></div>
              </div>
              <div className="mt-6 flex gap-2"><button className="btn btn-sm flex-1" type="button">Find a partner</button><button className="btn btn-ghost btn-sm" type="button">Requests <span className="badge badge-sm">2</span></button></div>
            </div>
          </article>

          <article id="recent-boards" className="card card-border bg-base-100">
            <div className="card-body p-0">
              <div className="flex items-center justify-between px-6 pb-3 pt-6 sm:px-7 sm:pt-7"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/40">Your workspace</p><h3 className="card-title mt-1">Recent boards</h3></div><button className="btn btn-ghost btn-sm" type="button">All boards <ArrowRight size={15} /></button></div>
              <ul className="list px-2 pb-2 sm:px-3 sm:pb-3">
                {recentBoards.map((board) => (
                  <li className="list-row items-center rounded-box hover:bg-base-200" key={board.title}>
                    <div className={`flex size-12 items-center justify-center rounded-box font-serif text-xs font-semibold ${board.tone}`}>{board.mark}</div>
                    <div className="list-col-grow min-w-0"><Link href="/boards/current" className="truncate text-sm font-semibold hover:underline">{board.title}</Link><p className="mt-1 flex items-center gap-2 text-xs text-base-content/45"><span>{board.subject}</span><span>·</span><span>{board.time}</span></p></div>
                    <button type="button" className="btn btn-ghost btn-circle btn-sm" aria-label={`More options for ${board.title}`}><MoreHorizontal size={17} /></button>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <article className="card card-border bg-base-200/70"><div className="card-body"><BookOpen size={19} className="text-primary" /><h3 className="card-title mt-2 text-base">Start from a topic</h3><p className="text-sm leading-6 text-base-content/55">Choose a skill, difficulty, and how much help you want.</p><div className="card-actions mt-2"><button type="button" className="btn btn-ghost btn-sm px-0">Browse practice <ArrowRight size={15} /></button></div></div></article>
          <article className="card card-border bg-base-200/70"><div className="card-body"><Calculator size={19} className="text-success" /><h3 className="card-title mt-2 text-base">Take a short diagnostic</h3><p className="text-sm leading-6 text-base-content/55">Five purposeful problems to find the next useful focus.</p><div className="card-actions mt-2"><button type="button" className="btn btn-ghost btn-sm px-0">Start diagnostic <ArrowRight size={15} /></button></div></div></article>
        </section>
      </div>
    </AppShell>
  );
}

export default async function HomePage() {
  const user = await requireCurrentUser("/home");
  return <HomeDashboard user={user} />;
}
