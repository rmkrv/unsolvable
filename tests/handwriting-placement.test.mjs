import test from "node:test";
import assert from "node:assert/strict";
import { findFreeHandwritingAnchor } from "../lib/handwriting-placement.mjs";

test("places the correction to the right of a mistaken digit when space is clear", () => {
  const anchor = findFreeHandwritingAnchor({
    target: { x: 180, y: 80, width: 22, height: 28 },
    occupied: [{ x: 40, y: 80, width: 162, height: 28 }],
    viewport: { x: 0, y: 0, width: 700, height: 450 },
    width: 190,
    height: 26,
  });
  assert.ok(anchor.x > 202);
  assert.equal(anchor.y, 80);
});

test("moves the correction below when the right side is occupied", () => {
  const anchor = findFreeHandwritingAnchor({
    target: { x: 180, y: 80, width: 22, height: 28 },
    occupied: [
      { x: 40, y: 80, width: 162, height: 28 },
      { x: 230, y: 70, width: 240, height: 50 },
    ],
    viewport: { x: 0, y: 0, width: 700, height: 450 },
    width: 190,
    height: 26,
  });
  assert.ok(anchor.y > 108);
});
