import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, TrendingUp, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { requireRolePage } from "@/lib/server/auth/viewer-service";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const user = await requireRolePage("/analysis", "student");
  const boards = await listUserBoards(user, 50);
  const results = boards.filter((board) => board.topicTest?.status === "complete" && board.topicTest.analysis);
  const latest = results[0]?.topicTest;
  const strengths = unique(results.flatMap((board) => board.topicTest?.analysis?.strengths ?? [])).slice(0, 4);
  const improvements = unique(results.flatMap((board) => board.topicTest?.analysis?.improvements ?? [])).slice(0, 4);

  return (
    <AppShell user={user} active="weak-spots" title="Analysis">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 xl:px-12">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Learning evidence</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Analysis</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Grades are explained from your submitted answers and the reasoning visible on each board.</p>
          </div>
          <Button asChild><Link href="/topics">Start a topic test<ArrowRight /></Link></Button>
        </header>

        {latest?.analysis ? (
          <>
            <section className="mt-7 grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
              <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between"><Badge variant="secondary">Latest result</Badge><span className="text-xs text-muted-foreground">{latest.subtopic}</span></div>
                  <div className="mt-5 flex items-end gap-4"><span className="text-7xl font-semibold tracking-[-0.07em]">{latest.analysis.grade}</span><span className="pb-2 text-lg text-muted-foreground">{latest.analysis.score}/100</span></div>
                  <CardTitle className="mt-4 text-xl">{latest.topicName}</CardTitle>
                  <CardDescription>{latest.analysis.gradeReason}</CardDescription>
                </CardHeader>
              </Card>

              <Card className="shadow-sm">
                <CardHeader><div className="flex size-10 items-center justify-center rounded-lg bg-muted"><BarChart3 size={19} /></div><CardTitle className="mt-3">Overall analysis</CardTitle><CardDescription>{latest.analysis.summary}</CardDescription></CardHeader>
                <CardContent className="grid gap-5 sm:grid-cols-2">
                  <InsightList title="What you do well" icon={CheckCircle2} items={strengths} />
                  <InsightList title="What to improve" icon={TrendingUp} items={improvements} />
                </CardContent>
              </Card>
            </section>

            {latest.analysis.breakdown.length ? (
              <section className="mt-6" aria-labelledby="breakdown-title">
                <Card className="shadow-sm">
                  <CardHeader><CardTitle id="breakdown-title">Latest task breakdown</CardTitle><CardDescription>What happened on each task, and where the reasoning can improve.</CardDescription></CardHeader>
                  <CardContent className="divide-y divide-border">
                    {latest.analysis.breakdown.map((item) => <div className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[7rem_1fr]" key={`${item.task}-${item.outcome}`}><div><p className="font-medium">Task {item.task}</p><Badge className="mt-1 capitalize" variant="outline">{item.outcome}</Badge></div><p className="text-sm leading-6 text-muted-foreground">{item.explanation}</p></div>)}
                  </CardContent>
                </Card>
              </section>
            ) : null}

            <section className="mt-8" aria-labelledby="results-title">
              <div className="mb-3 flex items-center justify-between"><h3 id="results-title" className="text-lg font-semibold">Results</h3><span className="text-xs text-muted-foreground">{results.length} completed</span></div>
              <div className="grid gap-3">
                {results.map((board) => {
                  const test = board.topicTest!;
                  const analysis = test.analysis!;
                  return <Card className="py-0 shadow-none" key={board.boardId}><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-xl font-semibold">{analysis.grade}</span>
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{test.subtopic}</p><Badge variant="outline">{test.mode}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{analysis.summary}</p></div>
                    <div className="flex items-center gap-3 sm:pl-4"><span className="text-sm font-semibold">{analysis.score}/100</span><Button asChild variant="ghost" size="icon-sm"><Link href={`/boards/${encodeURIComponent(board.boardId)}`} aria-label={`Open ${test.subtopic} result`}><ArrowRight /></Link></Button></div>
                  </CardContent></Card>;
                })}
              </div>
            </section>
          </>
        ) : (
          <Card className="mt-8 border-dashed shadow-none">
            <CardContent className="flex flex-col items-center py-16 text-center"><span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><ClipboardCheck /></span><h3 className="mt-4 text-xl font-semibold">No analysis yet</h3><p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Complete a topic test and Nyx will explain your grade, strengths, and the exact points to revisit.</p><Button asChild className="mt-6"><Link href="/topics">Choose a topic<ArrowRight /></Link></Button></CardContent>
          </Card>
        )}
      </main>
    </AppShell>
  );
}

function InsightList({ title, icon: Icon, items }: { title: string; icon: typeof TriangleAlert; items: string[] }) {
  return <div><div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</div><ul className="mt-3 space-y-2">{items.map((item) => <li className="text-sm leading-5 text-muted-foreground" key={item}>• {item}</li>)}</ul></div>;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
