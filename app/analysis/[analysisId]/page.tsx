import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AnalysisBreakdown, AnalysisOverview } from "@/components/analysis/analysis-report";
import { Button } from "@/components/ui/button";
import { buildResultOverview } from "@/lib/domain/analysis-performance";
import { readTopicTestAnalysis } from "@/lib/server/analyses/analysis-service";
import { requireRolePage } from "@/lib/server/auth/viewer-service";

export const dynamic = "force-dynamic";

export default async function AnalysisResultPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const user = await requireRolePage("/analysis", "student");
  const { analysisId } = await params;
  const result = await readTopicTestAnalysis(user, analysisId);
  if (!result) notFound();

  return (
    <AppShell user={user} active="weak-spots" title="Analysis">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 xl:px-12">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Learning evidence</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Analysis</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Grades are explained from your submitted answers and the reasoning visible on each board.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/analysis"><ArrowLeft />All results</Link></Button><Button asChild><Link href="/topics">Start a topic test<ArrowRight /></Link></Button></div>
        </header>

        <AnalysisOverview overview={buildResultOverview(result, `${result.mode} result`)} />
        <AnalysisBreakdown result={result} />
      </main>
    </AppShell>
  );
}
