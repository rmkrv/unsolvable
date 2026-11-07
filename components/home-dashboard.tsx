import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Clock3,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NewBoardButton } from "@/components/new-board-button";
import type { AuthenticatedUser } from "@/lib/server/auth/current-user";
import type { BoardSummary } from "@/lib/server/boards/board-repository";
import type { HomeInsights } from "@/lib/server/users/user-repository";

const previewBoards: BoardSummary[] = [
  { boardId: "preview-limits", title: "Limits and continuity", subject: "Calculus", lastOpenedAt: Date.now() - 720_000, updatedAt: Date.now() - 720_000, eventVersion: 4 },
  { boardId: "preview-quadratics", title: "Quadratic transformations", subject: "Algebra", lastOpenedAt: Date.now() - 86_400_000, updatedAt: Date.now() - 86_400_000, eventVersion: 3 },
  { boardId: "preview-forces", title: "Forces on an incline", subject: "Mechanics", lastOpenedAt: Date.now() - 345_600_000, updatedAt: Date.now() - 345_600_000, eventVersion: 2 },
];

const previewInsights: HomeInsights = {
  friendCount: 3,
  pendingRequestCount: 2,
  weakSpot: { skillId: "factoring", skillName: "Factoring structure", score: 58, confidence: 66, evidenceCount: 3, calculatedAt: Date.now() },
};

export function HomeDashboard({
  user,
  recentBoards = previewBoards,
  insights = previewInsights,
  isPreview = true,
}: {
  user: AuthenticatedUser;
  recentBoards?: BoardSummary[];
  insights?: HomeInsights;
  isPreview?: boolean;
}) {
  return (
    <HomePageFrame user={user}>
      <HomeDashboardHeader user={user} isPreview={isPreview} />
      <PrimaryHomeSection recentBoards={recentBoards} insights={insights} />
      <section className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <FriendsHomeCard insights={insights} />
        <RecentBoardsHomeCard recentBoards={recentBoards} />
      </section>
      <QuickStartSection />
    </HomePageFrame>
  );
}

export function HomePageFrame({ user, children }: { user: AuthenticatedUser; children: React.ReactNode }) {
  return (
    <AppShell user={user} active="home" title="Home">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-10 xl:px-12">
        {children}
      </div>
    </AppShell>
  );
}

export function HomeDashboardHeader({ user, isPreview = false }: { user: AuthenticatedUser; isPreview?: boolean }) {
  const firstName = (user.fullName || user.displayName).split(/[\s@]/)[0];
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/42">{dateLabel}</p>
          {isPreview && <span className="badge badge-outline badge-sm">Design preview</span>}
        </div>
        <h2 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Good to see you, {firstName}.</h2>
        <p className="mt-3 text-base text-base-content/58">Pick up the thread, or start with the idea that needs attention.</p>
      </div>
      <NewBoardButton
        className="btn hidden sm:inline-flex"
        href={isPreview ? "/auth/sign-up?redirectTo=/boards/current" : undefined}
      />
    </div>
  );
}

export function PrimaryHomeSection({ recentBoards, insights }: { recentBoards: BoardSummary[]; insights: HomeInsights }) {
  const recent = recentBoards[0];
  const boardHref = recent ? `/boards/${encodeURIComponent(recent.boardId)}` : "/boards/current";

  return (
    <section className="mt-9 grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
      <article className="card overflow-hidden bg-neutral text-neutral-content shadow-xl shadow-neutral/10">
        <div className="card-body min-h-[330px] justify-between p-7 sm:p-9">
          <div className="flex items-start justify-between gap-5">
            <div>
              <span className="badge border-white/15 bg-white/8 text-white/75">{recent ? "Continue practice" : "Start practicing"}</span>
              <h3 className="mt-5 max-w-2xl font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">{recent ? recent.title : "Open a blank board and work through the difficult part."}</h3>
              <p className="mt-4 max-w-xl leading-7 text-neutral-content/62">{recent ? "Your pages and tutor context are ready where you left them." : "Write naturally, ask for a hint when you need one, and keep every step in one place."}</p>
            </div>
            <div className="hidden size-16 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 sm:flex"><Sparkles size={26} /></div>
          </div>
          <div className="card-actions mt-8 items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-neutral-content/52"><Clock3 size={14} /> {recent ? `Last opened ${formatRelativeTime(recent.lastOpenedAt)}` : "No boards yet"}</div>
            <Link href={boardHref} className="btn btn-primary">{recent ? "Continue board" : "Create board"} <ArrowRight size={17} /></Link>
          </div>
        </div>
      </article>

      <article id="weak-spots" className="card card-border bg-base-100">
        <div className="card-body p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-box bg-warning/12 text-warning"><Target size={20} /></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/40">Weak spot</p><h3 className="font-semibold">{insights.weakSpot?.skillName || "Not enough evidence yet"}</h3></div></div>
            {insights.weakSpot && <span className="badge badge-warning badge-soft badge-sm">{formatConfidence(insights.weakSpot.confidence)} confidence</span>}
          </div>
          {insights.weakSpot ? <>
            <div className="mt-7 rounded-box bg-base-200 p-5">
              <div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-semibold tracking-tight">{insights.weakSpot.score}%</p><p className="mt-1 text-xs text-base-content/48">mastery estimate</p></div><p className="text-right text-xs leading-5 text-base-content/48">{insights.weakSpot.evidenceCount} evidence points</p></div>
              <progress className="progress progress-warning mt-4 h-2" value={insights.weakSpot.score} max="100" />
            </div>
            <p className="mt-5 text-sm leading-6 text-base-content/58">This estimate is based on your saved practice evidence, not a permanent label.</p>
          </> : <p className="mt-7 rounded-box bg-base-200 p-5 text-sm leading-6 text-base-content/58">Complete a few practice attempts and this section will show the first skill worth revisiting.</p>}
          <div className="card-actions mt-2 justify-end"><Link className="btn btn-ghost btn-sm" href="/weak-spots">{insights.weakSpot ? "See evidence" : "Start diagnostic"} <ArrowRight size={15} /></Link></div>
        </div>
      </article>
    </section>
  );
}

export function FriendsHomeCard({ insights }: { insights: HomeInsights }) {
  return (
    <article id="friends" className="card card-border bg-base-100">
      <div className="card-body p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/40">Study together</p><h3 className="card-title mt-1">Friends</h3></div><Users className="text-base-content/35" size={22} /></div>
        <div className="mt-5 flex items-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-base-200 text-sm font-bold">{insights.friendCount}</div>
          <div className="ml-4"><p className="text-sm font-semibold">{insights.friendCount ? `${insights.friendCount} study ${insights.friendCount === 1 ? "partner" : "partners"}` : "No study partners yet"}</p><p className="mt-0.5 text-xs text-base-content/48">{insights.pendingRequestCount ? `${insights.pendingRequestCount} pending request${insights.pendingRequestCount === 1 ? "" : "s"}` : "Find someone when you are ready to collaborate."}</p></div>
        </div>
        <div className="mt-6 flex gap-2"><Link className="btn btn-sm flex-1" href="/friends">Find a partner</Link><Link className="btn btn-ghost btn-sm" href="/friends">Requests <span className="badge badge-sm">{insights.pendingRequestCount}</span></Link></div>
      </div>
    </article>
  );
}

export function RecentBoardsHomeCard({ recentBoards }: { recentBoards: BoardSummary[] }) {
  return (
    <article id="recent-boards" className="card card-border bg-base-100">
      <div className="card-body p-0">
        <div className="flex items-center justify-between px-6 pb-3 pt-6 sm:px-7 sm:pt-7"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/40">Your workspace</p><h3 className="card-title mt-1">Recent boards</h3></div><Link className="btn btn-ghost btn-sm" href="/boards">All boards <ArrowRight size={15} /></Link></div>
        <ul className="list px-2 pb-2 sm:px-3 sm:pb-3">
          {recentBoards.map((board) => (
            <li className="list-row items-center rounded-box hover:bg-base-200" key={board.boardId}>
              <div className="flex size-12 items-center justify-center rounded-box bg-primary/10 font-serif text-xs font-semibold text-primary">{board.title.slice(0, 2).toUpperCase()}</div>
              <div className="list-col-grow min-w-0"><Link href={`/boards/${encodeURIComponent(board.boardId)}`} className="truncate text-sm font-semibold hover:underline">{board.title}</Link><p className="mt-1 flex items-center gap-2 text-xs text-base-content/45"><span>{board.subject || "Mathematics"}</span><span>·</span><span>{formatRelativeTime(board.lastOpenedAt)}</span></p></div>
              <Link href={`/boards/${encodeURIComponent(board.boardId)}`} className="btn btn-ghost btn-circle btn-sm" aria-label={`Open ${board.title}`}><ArrowRight size={17} /></Link>
            </li>
          ))}
          {!recentBoards.length && <li className="px-5 py-8 text-center text-sm text-base-content/50">Your boards will appear here after you create one.</li>}
        </ul>
      </div>
    </article>
  );
}

export function QuickStartSection() {
  return (
    <section className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <article className="card card-border bg-base-200/70"><div className="card-body"><BookOpen size={19} className="text-primary" /><h3 className="card-title mt-2 text-base">Start from a topic</h3><p className="text-sm leading-6 text-base-content/55">Choose a skill, difficulty, and how much help you want.</p><div className="card-actions mt-2"><Link href="/boards/current" className="btn btn-ghost btn-sm px-0">Browse practice <ArrowRight size={15} /></Link></div></div></article>
      <article className="card card-border bg-base-200/70"><div className="card-body"><Calculator size={19} className="text-success" /><h3 className="card-title mt-2 text-base">Take a short diagnostic</h3><p className="text-sm leading-6 text-base-content/55">Five purposeful problems to find the next useful focus.</p><div className="card-actions mt-2"><Link href="/weak-spots" className="btn btn-ghost btn-sm px-0">Start diagnostic <ArrowRight size={15} /></Link></div></div></article>
    </section>
  );
}

function formatRelativeTime(value: number) {
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatConfidence(value: number) {
  if (value >= 75) return "High";
  if (value >= 45) return "Medium";
  return "Low";
}
