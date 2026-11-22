import { BarChart3, CheckCircle2, TrendingUp, TriangleAlert } from "lucide-react";
import { MathText } from "@/components/analysis/math-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisOverviewData } from "@/lib/domain/analysis-performance";
import type { SavedTopicTestAnalysis } from "@/lib/server/analyses/analysis-repository";

export function AnalysisOverview({ overview }: { overview: AnalysisOverviewData }) {
  return (
    <section className="mt-7 grid gap-4 lg:grid-cols-[0.9fr_1.4fr]">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm lg:min-h-[34.75rem]">
        <CardHeader>
          <div className="flex items-center justify-between gap-4"><Badge variant="secondary">{overview.label}</Badge><span className="truncate text-xs text-muted-foreground">{overview.context}</span></div>
          <div className="mt-5 flex items-end gap-4"><span className="text-7xl font-semibold tracking-[-0.07em]">{overview.grade}</span><span className="pb-2 text-lg text-muted-foreground">{overview.score}/100</span></div>
          <CardTitle className="mt-4 text-xl">{overview.title}</CardTitle>
          <CardDescription className="leading-6"><MathText>{overview.gradeReason}</MathText></CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-sm lg:min-h-[34.75rem]">
        <CardHeader><div className="flex size-10 items-center justify-center rounded-lg bg-muted"><BarChart3 size={19} /></div><CardTitle className="mt-3">Overall analysis</CardTitle><CardDescription className="leading-6"><MathText>{overview.summary}</MathText></CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <InsightList title="What you do well" icon={CheckCircle2} items={overview.strengths} />
          <InsightList title="What to improve" icon={TrendingUp} items={overview.improvements} />
        </CardContent>
      </Card>
    </section>
  );
}

export function AnalysisBreakdown({ result, title = "Task breakdown" }: { result: SavedTopicTestAnalysis; title?: string }) {
  if (!result.analysis.breakdown.length) return null;
  return (
    <section className="mt-6" aria-labelledby="breakdown-title">
      <Card className="shadow-sm">
        <CardHeader><CardTitle id="breakdown-title">{title}</CardTitle><CardDescription>What happened on each task, and where the reasoning can improve.</CardDescription></CardHeader>
        <CardContent className="divide-y divide-border">
          {result.analysis.breakdown.map((item) => <div className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[7rem_1fr]" key={`${item.task}-${item.outcome}`}><div><p className="font-medium">Task {item.task}</p><Badge className="mt-1 capitalize" variant="outline">{item.outcome}</Badge></div><p className="text-sm leading-6 text-muted-foreground"><MathText>{item.explanation}</MathText></p></div>)}
        </CardContent>
      </Card>
    </section>
  );
}

function InsightList({ title, icon: Icon, items }: { title: string; icon: typeof TriangleAlert; items: string[] }) {
  return <div><div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</div><ul className="mt-3 space-y-2">{items.map((item) => <li className="text-sm leading-5 text-muted-foreground" key={item}>• <MathText>{item}</MathText></li>)}</ul></div>;
}
