import { CheckCircle2, TrendingUp } from "lucide-react";
import type { TopicTestAnalysis } from "@/lib/domain/topic-test";

export function TopicTestAnalysisDetails({ analysis }: { analysis: TopicTestAnalysis }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ResultList icon={CheckCircle2} title="Strong" items={analysis.strengths} />
        <ResultList icon={TrendingUp} title="Improve" items={analysis.improvements} />
      </div>
      {analysis.breakdown.length ? (
        <div>
          <h3 className="text-sm font-semibold">Task breakdown</h3>
          <div className="mt-2 divide-y divide-border rounded-xl border border-border">
            {analysis.breakdown.map((item) => (
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[6rem_1fr]" key={`${item.task}-${item.outcome}`}>
                <div><p className="text-sm font-medium">Task {item.task}</p><p className="text-xs capitalize text-muted-foreground">{item.outcome}</p></div>
                <p className="text-sm leading-5 text-muted-foreground">{item.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultList({ icon: Icon, title, items }: { icon: typeof CheckCircle2; title: string; items: string[] }) {
  return <div><div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" />{title}</div><ul className="mt-2 space-y-1.5">{items.slice(0, 3).map((item) => <li className="text-xs leading-5 text-muted-foreground" key={item}>• {item}</li>)}</ul></div>;
}
