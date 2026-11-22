import test from "node:test";
import assert from "node:assert/strict";
import { buildOverallPerformanceReport, gradeForScore } from "../lib/domain/analysis-performance.ts";

function result(id, topicName, score, completedAt, strengths = ["Clear reasoning."], improvements = ["Check the final step."]) {
  return {
    id,
    topicName,
    subtopic: `${topicName} foundations`,
    mode: "test",
    analysis: {
      grade: gradeForScore(score),
      score,
      gradeReason: "Test result.",
      summary: "Test summary.",
      strengths,
      improvements,
      breakdown: [],
      completedAt,
    },
  };
}

test("overall performance is recalculated when a new exam is added", () => {
  const previous = [
    result("1", "Algebra", 90, 1),
    result("2", "Algebra", 80, 2),
    result("3", "Geometry", 50, 3),
    result("4", "Geometry", 60, 4),
  ];
  const before = buildOverallPerformanceReport(previous);
  const after = buildOverallPerformanceReport([
    ...previous,
    result("5", "Geometry", 90, 5, ["Applied the theorem correctly."], ["Label the diagram first."]),
  ]);

  assert.equal(before?.score, 70);
  assert.equal(after?.score, 74);
  assert.equal(after?.grade, "C");
  assert.equal(after?.resultCount, 5);
  assert.match(after?.summary ?? "", /Algebra is your strongest topic at 85\/100/);
  assert.match(after?.summary ?? "", /Geometry needs the most attention at 67\/100/);
  assert.match(after?.summary ?? "", /Geometry performance is improving/);
});

test("single-topic reports use the saved strengths and improvements", () => {
  const report = buildOverallPerformanceReport([
    result("1", "Calculus", 88, 1, ["Differentiates accurately."], ["Explain the chain rule."]),
  ]);

  assert.equal(report?.score, 88);
  assert.equal(report?.grade, "B");
  assert.deepEqual(report?.strengths, ["Calculus (88/100): Differentiates accurately."]);
  assert.deepEqual(report?.improvements, ["Calculus (88/100): Explain the chain rule."]);
});

test("overall grades use a stable A-F scale", () => {
  assert.equal(gradeForScore(90), "A");
  assert.equal(gradeForScore(89), "B");
  assert.equal(gradeForScore(70), "C");
  assert.equal(gradeForScore(60), "D");
  assert.equal(gradeForScore(59), "F");
});
