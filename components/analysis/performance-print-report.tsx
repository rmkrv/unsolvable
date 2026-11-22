import { MathText } from "@/components/analysis/math-text";
import type { OverallPerformanceReport, PerformanceAnalysisResult } from "@/lib/domain/analysis-performance";

export function PerformancePrintReport({
  report,
  results,
}: {
  report: OverallPerformanceReport;
  results: PerformanceAnalysisResult[];
}) {
  const latestResults = [...results]
    .sort((left, right) => right.analysis.completedAt - left.analysis.completedAt)
    .slice(0, 10);

  return (
    <article className="performance-print-document">
      <div className="flex items-start justify-between gap-8 rounded-box border border-primary/30 bg-primary/10 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Unsolvable learning report</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Performance analysis</h1>
          <p className="mt-2 text-sm text-base-content/60">{formatDate(report.completedFrom)} - {formatDate(report.completedTo)} · {report.resultCount} completed {report.resultCount === 1 ? "exam" : "exams"}</p>
        </div>
        <div className="rounded-box bg-primary px-6 py-4 text-right text-primary-content shadow-sm">
          <p className="text-5xl font-semibold tracking-tight">{report.grade}</p>
          <p className="mt-1 text-sm text-primary-content/80">{report.score}/100 overall</p>
        </div>
      </div>

      <section className="card card-border mt-6 border-primary/30 bg-primary/10 shadow-none">
        <div className="card-body gap-2 p-5">
          <h2 className="card-title text-base text-primary">Overall summary</h2>
          <p className="text-sm leading-6 text-base-content/80"><MathText>{report.summary}</MathText></p>
          <p className="text-xs text-base-content/65"><MathText>{report.gradeReason}</MathText></p>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-5">
        <InsightSection title="What you do well" items={report.strengths} tone="success" />
        <InsightSection title="What to improve" items={report.improvements} tone="warning" />
      </div>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-base font-semibold">Recent results</h2>
          <p className="text-xs text-base-content/50">Latest {latestResults.length} shown</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm table-zebra table-fixed">
            <thead className="bg-primary/10 text-primary"><tr><th className="w-[15%]">Date</th><th className="w-[19%]">Topic</th><th>Subtopic</th><th className="w-[13%]">Mode</th><th className="w-[18%] text-right">Result</th></tr></thead>
            <tbody>
              {latestResults.map((result) => <tr key={result.id}><td>{formatDate(result.analysis.completedAt)}</td><td className="break-words">{result.topicName}</td><td className="break-words">{result.subtopic}</td><td className="capitalize">{result.mode}</td><td className="text-right"><span className={`badge badge-soft badge-sm ${scoreBadge(result.analysis.score)}`}>{result.analysis.grade} · {result.analysis.score}/100</span></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-7 border-t border-base-300 pt-3 text-xs text-base-content/60">Updated through {formatDate(report.completedTo)}.</p>
      <footer className="performance-print-footer" aria-hidden="true">unsolvable</footer>
    </article>
  );
}

function InsightSection({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  const styles = tone === "success"
    ? { card: "border-success/40 bg-success/10", title: "text-success", dot: "bg-success" }
    : { card: "border-warning/45 bg-warning/10", title: "text-warning", dot: "bg-warning" };
  return <section className={`card card-border shadow-none ${styles.card}`}><div className="card-body gap-3 p-5"><h2 className={`card-title text-base ${styles.title}`}><span className={`size-2 rounded-full ${styles.dot}`} />{title}</h2><ul className="space-y-2">{items.map((item) => <li className="grid grid-cols-[auto_1fr] gap-2 text-sm leading-5 text-base-content/80" key={item}><span className={`mt-2 size-1.5 rounded-full ${styles.dot}`} /><span><MathText>{item}</MathText></span></li>)}</ul></div></section>;
}

function scoreBadge(score: number) {
  if (score >= 80) return "badge-success";
  if (score >= 60) return "badge-warning";
  return "badge-error";
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
