import test from "node:test";
import assert from "node:assert/strict";
import { dynamicTools, sanitizeBoardAction } from "../bridge/actions.mjs";
import { HINT_LEVELS, hintPolicy } from "../bridge/hint-policy.mjs";

test("defines distinct behavior for every help level", () => {
  assert.equal(HINT_LEVELS.length, 6);
  assert.deepEqual(HINT_LEVELS.map(({ level }) => level), [0, 1, 2, 3, 4, 5]);
  assert.match(hintPolicy(0).instruction, /Do not provide a hint/);
  assert.match(hintPolicy(5).instruction, /complete worked solution/);
  assert.equal(hintPolicy(99).level, 5);
  assert.equal(hintPolicy(undefined).level, 2);
});

test("exposes direct board mutation tools for agent/user capability parity", () => {
  const names = new Set(dynamicTools.map((tool) => tool.name));
  for (const name of [
    "board_add_strokes",
    "board_move_strokes",
    "board_delete_strokes",
    "board_manage_page",
    "board_set_hint_level",
  ]) assert.ok(names.has(name), `${name} should be available`);
});

test("filters hallucinated stroke ids from visual feedback", () => {
  const result = sanitizeBoardAction(
    "board_feedback",
    {
      verdict: "potential_mistake",
      mark: "underline",
      strokeIds: ["real", "invented"],
      speech: "Check this step.",
      hintLevel: 2,
      confidence: 0.94,
    },
    new Set(["real"]),
  );
  assert.deepEqual(result.strokeIds, ["real"]);
});

test("rejects unsupported drawing templates", () => {
  assert.throws(
    () => sanitizeBoardAction("board_draw", { template: "raw_svg" }, new Set()),
    /Unsupported drawing template/,
  );
});

test("clamps drawing anchors and scale", () => {
  const result = sanitizeBoardAction(
    "board_draw",
    { template: "parabola", anchor: { x: 999999, y: -999999 }, scale: 99, labels: [], narration: "" },
    new Set(),
  );
  assert.deepEqual(result.anchor, { x: 20000, y: -20000 });
  assert.equal(result.scale, 3);
});

test("accepts bounded plain text and rejects unsupported characters", () => {
  const action = sanitizeBoardAction(
    "board_write_text",
    { text: "  Input A / Output B  ", anchor: { x: 100, y: 200 }, size: 22, narration: "" },
    new Set(),
  );
  assert.equal(action.type, "text");
  assert.equal(action.text, "Input A / Output B");
  assert.deepEqual(action.anchor, { x: 100, y: 200 });
  assert.throws(() => sanitizeBoardAction("board_write_text", { text: "Hello 🌍" }, new Set()), /printable ASCII/);
});

test("accepts a bounded arrow and rejects invalid endpoints", () => {
  const action = sanitizeBoardAction(
    "board_draw_arrow",
    { from: { x: 10, y: 20 }, to: { x: 90, y: 20 }, narration: "" },
    new Set(),
  );
  assert.equal(action.type, "arrow");
  assert.deepEqual(action.to, { x: 90, y: 20 });
  assert.throws(() => sanitizeBoardAction("board_draw_arrow", { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }, new Set()), /Arrow length/);
  assert.throws(() => sanitizeBoardAction("board_draw_arrow", { from: { x: 0, y: 0 }, to: { x: Infinity, y: 0 } }, new Set()), /finite board coordinates/);
});

test("rejects non-English spoken feedback so Codex can retry in English", () => {
  assert.throws(
    () => sanitizeBoardAction("board_say", { speech: "Check this шаг.", tone: "calm" }, new Set()),
    /Spoken text must be in English/,
  );
  assert.equal(
    sanitizeBoardAction("board_say", { speech: "Check this step.", tone: "calm" }, new Set()).speech,
    "Check this step.",
  );
});

test("handwritten correction keeps only real nearby stroke IDs", () => {
  const action = sanitizeBoardAction(
    "board_write_equation",
    { text: "1 + 2 = 3", nearStrokeIds: ["four", "invented"], size: 26, narration: "" },
    new Set(["four"]),
  );
  assert.equal(action.type, "write");
  assert.equal(action.text, "1 + 2 = 3");
  assert.deepEqual(action.nearStrokeIds, ["four"]);
});

test("refuses to handwrite an arithmetically false correction", () => {
  assert.throws(
    () => sanitizeBoardAction("board_write_equation", { text: "1 + 2 = 4", nearStrokeIds: [], narration: "" }, new Set()),
    /proposed correction is false/,
  );
});

test("allows readable symbolic and integral notation for handwriting", () => {
  const action = sanitizeBoardAction(
    "board_write_equation",
    { text: "∫_0^2(x^2+x-2)dx=2/3", nearStrokeIds: [], narration: "" },
    new Set(),
  );
  assert.equal(action.type, "write");
  assert.ok(action.text.includes("∫"));
});

