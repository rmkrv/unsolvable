import test from "node:test";
import assert from "node:assert/strict";
import { layoutHandwrittenMath, layoutPlainHandwriting } from "../lib/handwritten-math.mjs";

test("renders lowercase letters as distinct handwritten glyphs", () => {
  const lower = layoutHandwrittenMath("x", 26);
  const upper = layoutHandwrittenMath("X", 26);
  assert.ok(lower.paths.length > 0);
  assert.notDeepEqual(lower.paths[0].points, upper.paths[0].points);
  for (const letter of "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    assert.ok(layoutHandwrittenMath(letter, 26).paths.length > 0, `${letter} must have pen strokes`);
  }
});

test("raises powers and lays out division as a fraction", () => {
  const layout = layoutHandwrittenMath("x^3/3", 26);
  const numeratorX = layout.paths.filter((path) => path.character === "x").flatMap((path) => path.points);
  const exponent = layout.paths.filter((path) => path.character === "3")[0].points;
  const bar = layout.paths.find((path) => path.character === "fraction bar");
  assert.ok(Math.max(...exponent.map((point) => point[1])) < Math.max(...numeratorX.map((point) => point[1])));
  assert.ok(bar);
  assert.equal(bar.points[0][1], bar.points[1][1]);
  assert.ok(layout.height > 26);
});

test("supports integral limits and readable equation punctuation", () => {
  const layout = layoutHandwrittenMath("∫_0^2(x^2+x-2)dx=2/3", 26);
  assert.ok(layout.paths.some((path) => path.character === "∫"));
  assert.ok(layout.paths.some((path) => path.character === "x"));
  assert.ok(layout.width > 0);
  const integral = layoutHandwrittenMath("∫_0^2", 26);
  const sign = integral.paths.find((path) => path.character === "∫");
  const lower = integral.paths.find((path) => path.character === "0");
  const upper = integral.paths.find((path) => path.character === "2");
  assert.ok(sign.points.length > 10, "the integral sign should be a smooth handwritten curve");
  assert.ok(Math.max(...upper.points.map((point) => point[1])) < Math.min(...lower.points.map((point) => point[1])));
  assert.ok(Math.min(...upper.points.map((point) => point[0])) > Math.max(...sign.points.map((point) => point[0])));
});

test("plain text draws punctuation literally", () => {
  const layout = layoutPlainHandwriting("Input / Output", 22);
  assert.ok(layout.paths.some((path) => path.character === "/"));
  assert.ok(layout.paths.some((path) => path.character === "I"));
  assert.equal(layout.paths.some((path) => path.character === "fraction bar"), false);
});
