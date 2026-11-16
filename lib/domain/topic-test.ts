export type TopicTestMode = "preparation" | "test";
export type TopicTestStatus = "generating" | "ready" | "analyzing" | "complete" | "error";

export type TopicTestAnalysis = {
  grade: string;
  score: number;
  gradeReason: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  breakdown: Array<{ task: number; outcome: string; explanation: string }>;
  completedAt: number;
};

export type TopicTestSession = {
  topicSlug: string;
  topicName: string;
  subtopic: string;
  mode: TopicTestMode;
  status: TopicTestStatus;
  startedAt: number;
  answers?: string[];
  analysis?: TopicTestAnalysis;
  error?: string;
  errorStage?: "generation" | "analysis";
};

export type NewTopicTest = Pick<TopicTestSession, "topicSlug" | "topicName" | "subtopic" | "mode">;

export function createTopicTestSession(input: NewTopicTest): TopicTestSession {
  return { ...input, status: "generating", startedAt: Date.now() };
}

export function parseGeneratedTasks(value: string) {
  const lines = value
    .replace(/```[\s\S]*?\n|```/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const tasks = lines
    .map((line) => line.match(/^\s*(?:task\s*)?(\d+)[).:\-]\s*(.+)$/i)?.[2]?.trim())
    .filter((line): line is string => Boolean(line));
  return tasks.length === 5 ? tasks : [];
}

export function parseTopicTestAnalysis(value: string): TopicTestAnalysis | null {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>;
    const grade = typeof raw.grade === "string" ? raw.grade.trim().slice(0, 3) : "";
    const score = Math.max(0, Math.min(100, Math.round(Number(raw.score))));
    const gradeReason = typeof raw.gradeReason === "string" ? raw.gradeReason.trim() : "";
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
    const strengths = stringList(raw.strengths);
    const improvements = stringList(raw.improvements);
    const breakdown = Array.isArray(raw.breakdown)
      ? raw.breakdown.flatMap((entry, index) => {
          if (!entry || typeof entry !== "object") return [];
          const item = entry as Record<string, unknown>;
          const outcome = typeof item.outcome === "string" ? item.outcome.trim() : "";
          const explanation = typeof item.explanation === "string" ? item.explanation.trim() : "";
          return outcome && explanation ? [{ task: Math.max(1, Math.min(5, Number(item.task) || index + 1)), outcome, explanation }] : [];
        })
      : [];
    if (!grade || !Number.isFinite(score) || !gradeReason || !summary || !strengths.length || !improvements.length) return null;
    return { grade, score, gradeReason, summary, strengths, improvements, breakdown, completedAt: Date.now() };
  } catch {
    return null;
  }
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, 6)
    : [];
}
