import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  LayoutGrid,
  PenLine,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { NewBoardButton } from "@/components/new-board-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
      <QuickStartSection isPreview={isPreview} />
      <RecentBoardsHomeCard recentBoards={recentBoards} />
    </HomePageFrame>
  );
}

export function HomePageFrame({ user, children }: { user: AuthenticatedUser; children: React.ReactNode }) {
  return (
    <AppShell user={user} active="home" title="Home">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
        {children}
      </div>
    </AppShell>
  );
}

export function HomeDashboardHeader({ user, isPreview = false }: { user: AuthenticatedUser; isPreview?: boolean }) {
  const firstName = (user.fullName || user.displayName).split(/[\s@]/)[0];
  const dateLabel = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-7 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{dateLabel}</p>
          {isPreview && <Badge variant="outline">Design preview</Badge>}
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">Welcome back, {firstName}</h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Continue your work or choose one focused next step.</p>
      </div>
    </header>
  );
}

export function PrimaryHomeSection({ recentBoards, insights }: { recentBoards: BoardSummary[]; insights: HomeInsights }) {
  const recent = recentBoards[0];
  const boardHref = recent ? `/boards/${encodeURIComponent(recent.boardId)}` : "/boards/current";

  return (
    <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
      <Card className="motion-card overflow-hidden border-border bg-white shadow-sm">
        <CardHeader className="pb-0">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Badge variant="secondary">{recent ? "Resume session" : "Start practicing"}</Badge>
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground"><Sparkles size={18} /></div>
          </div>
          <CardTitle className="max-w-2xl text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">
            {recent ? recent.title : "Start a clear workspace for the problem in front of you."}
          </CardTitle>
          <CardDescription className="mt-2 max-w-xl text-sm leading-6 sm:text-base">
            {recent ? "Your pages and tutor context are ready exactly where you left them." : "Write naturally, ask for a hint, and keep every step in one place."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto flex-col items-start justify-between gap-4 pt-7 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={14} /> {recent ? `Last opened ${formatRelativeTime(recent.lastOpenedAt)}` : "No sessions yet"}</div>
          <Button asChild size="lg">
            <Link href={boardHref}>{recent ? "Continue board" : "Open a board"}<ArrowRight /></Link>
          </Button>
        </CardFooter>
      </Card>

      <Card id="weak-spots" className="motion-card shadow-sm">
        <CardHeader>
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground"><Target size={18} /></div>
          <CardTitle className="mt-3 text-lg">Next focus</CardTitle>
          <CardDescription>{insights.weakSpot ? "Based on your recent work" : "Build enough evidence to find a focus"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {insights.weakSpot ? (
            <>
              <div>
                <div className="flex items-end justify-between gap-3">
                  <div><p className="font-semibold">{insights.weakSpot.skillName}</p><p className="mt-1 text-xs text-muted-foreground">{insights.weakSpot.evidenceCount} evidence points</p></div>
                  <p className="text-2xl font-semibold tracking-tight">{insights.weakSpot.score}%</p>
                </div>
                <Progress className="mt-4" value={insights.weakSpot.score} />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">This estimate changes as you practice. It is a starting point, not a label.</p>
            </>
          ) : (
            <p className="rounded-lg bg-muted p-4 text-sm leading-6 text-muted-foreground">Complete a few attempts and the first useful skill to revisit will appear here.</p>
          )}
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href="/weak-spots">{insights.weakSpot ? "Practice this skill" : "Take a diagnostic"}<ArrowRight /></Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
}

export function QuickStartSection({ isPreview = false }: { isPreview?: boolean }) {
  return (
    <section className="mt-7" aria-labelledby="quick-actions-title">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="quick-actions-title" className="text-sm font-semibold">Quick actions</h3>
        <p className="hidden text-xs text-muted-foreground sm:block">Two different ways to start something new</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="motion-card gap-4 py-5 shadow-none transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><PenLine size={20} /></div>
            <div className="min-w-0 flex-1"><CardTitle className="text-base">New blank board</CardTitle><CardDescription className="mt-1">Work freely from a clean page.</CardDescription></div>
            <NewBoardButton className="shrink-0" href={isPreview ? "/auth/sign-up?redirectTo=/boards/current" : undefined} />
          </CardContent>
        </Card>
        <Card className="motion-card gap-4 py-5 shadow-none transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Users size={20} /></div>
            <div className="min-w-0 flex-1"><CardTitle className="text-base">Study together</CardTitle><CardDescription className="mt-1">Open your circle and invitations.</CardDescription></div>
            <Button asChild variant="outline"><Link href="/friends">Open<ArrowRight /></Link></Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function RecentBoardsHomeCard({ recentBoards }: { recentBoards: BoardSummary[] }) {
  return (
    <Card id="recent-boards" className="motion-card mt-7 gap-0 shadow-none">
      <CardHeader className="flex-row items-center justify-between border-b border-border pb-5">
        <div><CardTitle className="text-lg">Recent boards</CardTitle><CardDescription className="mt-1">Your latest work, in one place.</CardDescription></div>
        <Button asChild variant="ghost" size="sm"><Link href="/boards">View all<ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent className="px-3 py-2 sm:px-4">
        <ul className="divide-y divide-border">
          {recentBoards.map((board) => (
            <li className="flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-muted/70" key={board.boardId}>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><LayoutGrid size={17} /></div>
              <div className="min-w-0 flex-1"><Link href={`/boards/${encodeURIComponent(board.boardId)}`} className="block truncate text-sm font-medium hover:text-primary">{board.title}</Link><p className="mt-1 text-xs text-muted-foreground">{board.subject || "Mathematics"} · {formatRelativeTime(board.lastOpenedAt)}</p></div>
              <Button asChild variant="ghost" size="icon-sm"><Link href={`/boards/${encodeURIComponent(board.boardId)}`} aria-label={`Open ${board.title}`}><ArrowRight /></Link></Button>
            </li>
          ))}
          {!recentBoards.length && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Your boards will appear here after you create one.</li>}
        </ul>
      </CardContent>
    </Card>
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
