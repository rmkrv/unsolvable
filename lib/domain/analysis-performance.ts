import type { TopicTestAnalysis, TopicTestMode } from "./topic-test";

export type PerformanceAnalysisResult = {
  id: string;
  topicName: string;
  subtopic: string;
  mode: TopicTestMode;
  analysis: TopicTestAnalysis;
};

export type AnalysisOverviewData = {
  label: string;
  context: string;
  grade: string;
  score: number;
  title: string;
  gradeReason: string;
  summary: string;
  strengths: string[];
  improvements: string[];
};

export type OverallPerformanceReport = AnalysisOverviewData & {
  resultCount: number;
  completedFrom: number;
  completedTo: number;
};

type TopicPerformance = {
  name: string;
  average: number;
  results: PerformanceAnalysisResult[];
};

export function buildResultOverview(
  result: PerformanceAnalysisResult,
  label = "Latest result",
): AnalysisOverviewData {
  return {
    label,
    context: result.subtopic,
    grade: result.analysis.grade,
    score: result.analysis.score,
    title: result.topicName,
    gradeReason: result.analysis.gradeReason,
    summary: result.analysis.summary,
    strengths: result.analysis.strengths,
    improvements: result.analysis.improvements,
  };
}

export function buildOverallPerformanceReport(
  source: PerformanceAnalysisResult[],
): OverallPerformanceReport | null {
  if (!source.length) return null;

  const results = [...source].sort(
    (left, right) => right.analysis.completedAt - left.analysis.completedAt,
  );
  const score = roundedAverage(results.map((result) => result.analysis.score));
  const topics = topicPerformance(results);
  const strongest = topics[0];
  const weakestTopics = [...topics].sort(
    (left, right) => left.average - right.average || left.name.localeCompare(right.name),
  );
  const weakest = weakestTopics[0];
  const resultLabel = results.length === 1 ? "exam" : "exams";
  const summaryParts = [
    `Your overall score is ${score}/100 across ${results.length} completed ${resultLabel}.`,
  ];

  if (strongest && weakest && strongest.name !== weakest.name && strongest.average !== weakest.average) {
    summaryParts.push(`${strongest.name} is your strongest topic at ${strongest.average}/100.`);
    summaryParts.push(`${weakest.name} needs the most attention at ${weakest.average}/100.`);
  } else if (strongest && weakest && strongest.name !== weakest.name) {
    summaryParts.push(`Your measured topics are currently level at ${strongest.average}/100.`);
  } else if (strongest) {
    summaryParts.push(`${strongest.name} is currently averaging ${strongest.average}/100.`);
  }

  const weakestTrend = weakest ? topicTrend(weakest) : null;
  if (weakestTrend) summaryParts.push(weakestTrend);

  return {
    label: "Overall result",
    context: `${results.length} completed ${resultLabel}`,
    grade: gradeForScore(score),
    score,
    title: "Overall performance",
    gradeReason: `Calculated from ${results.length} completed ${resultLabel}. Each exam contributes equally to the overall mark.`,
    summary: summaryParts.join(" "),
    strengths: performanceInsights(topics, "strengths"),
    improvements: performanceInsights(
      weakestTopics,
      "improvements",
    ),
    resultCount: results.length,
    completedFrom: Math.min(...results.map((result) => result.analysis.completedAt)),
    completedTo: Math.max(...results.map((result) => result.analysis.completedAt)),
  };
}

export function gradeForScore(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function topicPerformance(results: PerformanceAnalysisResult[]) {
  const groups = new Map<string, { name: string; results: PerformanceAnalysisResult[] }>();
  for (const result of results) {
    const name = result.topicName.trim() || "Untitled topic";
    const key = name.toLocaleLowerCase();
    const group = groups.get(key) ?? { name, results: [] };
    group.results.push(result);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group): TopicPerformance => ({
      ...group,
      average: roundedAverage(group.results.map((result) => result.analysis.score)),
    }))
    .sort((left, right) => right.average - left.average || left.name.localeCompare(right.name));
}

function performanceInsights(
  topics: TopicPerformance[],
  field: "strengths" | "improvements",
) {
  if (topics.length === 1) {
    const topic = topics[0];
    const details = unique(topic.results.flatMap((result) => result.analysis[field])).slice(0, 3);
    return details.map((detail) => `${topic.name} (${topic.average}/100): ${detail}`);
  }

  return topics.slice(0, 3).map((topic) => {
    const detail = topic.results.find((result) => result.analysis[field][0])?.analysis[field][0];
    return detail
      ? `${topic.name} (${topic.average}/100): ${detail}`
      : `${topic.name} is averaging ${topic.average}/100.`;
  });
}

function topicTrend(topic: TopicPerformance) {
  if (topic.results.length < 2) return null;
  const latest = topic.results[0].analysis.score;
  const earlier = roundedAverage(topic.results.slice(1).map((result) => result.analysis.score));
  const difference = latest - earlier;
  if (difference >= 5) {
    return `${topic.name} performance is improving: the latest score is ${latest}/100, ${difference} points above the earlier average.`;
  }
  if (difference <= -5) {
    return `${topic.name} performance has recently declined: the latest score is ${latest}/100, ${Math.abs(difference)} points below the earlier average.`;
  }
  return `${topic.name} performance is steady, with the latest score close to the earlier average.`;
}

function roundedAverage(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
