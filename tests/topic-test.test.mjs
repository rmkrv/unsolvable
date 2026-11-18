import test from "node:test";
import assert from "node:assert/strict";
import { createTopicTestSession, normalizeTopicTestAnalysis } from "../lib/domain/topic-test.ts";

test("topic tests receive a stable analysis id before the board is created", () => {
  const session = createTopicTestSession({ topicSlug: "algebra", topicName: "Algebra", subtopic: "Linear equations", mode: "test" });
  assert.match(session.analysisId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(session.status, "generating");
});

test("stored topic analysis keeps its completion timestamp", () => {
  const completedAt = 1_794_918_222_677;
  const analysis = normalizeTopicTestAnalysis({
    grade: "A-",
    score: 92,
    gradeReason: "One notation issue kept this below an A.",
    summary: "Strong work overall.",
    strengths: ["Chain rule"],
    improvements: ["Show intermediate steps"],
    breakdown: [{ task: 1, outcome: "correct", explanation: "Correct reasoning." }],
    completedAt,
  });
  assert.equal(analysis?.completedAt, completedAt);
});
