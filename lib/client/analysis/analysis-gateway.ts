import type { TopicTestSession } from "@/lib/domain/topic-test";

export async function persistTopicTestResult(session: TopicTestSession) {
  if (!session.analysis) throw new Error("The analysis result is missing.");
  const response = await fetch("/api/student/analyses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: session.analysisId,
      topicSlug: session.topicSlug,
      topicName: session.topicName,
      subtopic: session.subtopic,
      mode: session.mode,
      answers: session.answers ?? [],
      analysis: session.analysis,
      startedAt: session.startedAt,
    }),
  });
  if (response.ok) return;
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  throw new Error(payload?.error?.message || "The analysis finished but could not be saved. Try again to keep the result.");
}
