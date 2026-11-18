import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnalysisBreakdown, AnalysisOverview } from "@/components/analysis/analysis-report";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listTopicTestAnalyses } from "@/lib/server/analyses/analysis-service";
import { requireRolePage } from "@/lib/server/auth/viewer-service";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const user = await requireRolePage("/analysis", "student");
  const results = await listTopicTestAnalyses(user, 50);
  const latest = results[0];
  const strengths = unique(results.flatMap((result) => result.analysis.strengths)).slice(0, 4);
  const improvements = unique(results.flatMap((result) => result.analysis.improvements)).slice(0, 4);

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

        {latest ? (
          <>
            <AnalysisOverview result={latest} strengths={strengths} improvements={improvements} />
            <AnalysisBreakdown result={latest} title="Latest task breakdown" />

            <section className="mt-8" aria-labelledby="results-title">
              <div className="mb-3 flex items-center justify-between"><h3 id="results-title" className="text-lg font-semibold">Results</h3><span className="text-xs text-muted-foreground">{results.length} completed</span></div>
              <div className="grid gap-3">
                {results.map((result) => {
                  const analysis = result.analysis;
                  return <Card className="group relative py-0 shadow-none transition-colors hover:border-primary/25" key={result.id}>
                    <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-xl font-semibold">{analysis.grade}</span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{result.subtopic}</p><Badge variant="outline">{result.mode}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{analysis.summary}</p></div>
                      <div className="flex items-center gap-3 sm:pl-4">
                        <span className="text-sm font-semibold">{analysis.score}/100</span>
                        <span className={buttonVariants({ variant: "ghost", size: "icon-sm", className: "pointer-events-none group-hover:bg-accent group-hover:text-accent-foreground" })} aria-hidden="true">
                          <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </CardContent>
                    <Link className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" href={`/analysis/${encodeURIComponent(result.id)}`} aria-label={`Open ${result.subtopic} analysis`} />
                  </Card>;
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

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
