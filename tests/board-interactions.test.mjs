import test from "node:test";
import assert from "node:assert/strict";
import { buildShapePaths, shapeBounds, snapLineEnd } from "../lib/board-interactions.mjs";

test("snaps lines to 45 degree increments without changing their length", () => {
  const end = snapLineEnd({ x: 0, y: 0 }, { x: 10, y: 2 });
  assert.ok(Math.abs(end.y) < 1e-10);
  assert.ok(Math.abs(Math.hypot(end.x, end.y) - Math.hypot(10, 2)) < 1e-10);
});

test("constrains rectangles to squares in the drag direction", () => {
  assert.deepEqual(shapeBounds({ x: 10, y: 20 }, { x: 40, y: 30 }, true), {
    x: 10,
    y: 20,
    width: 30,
    height: 30,
  });
  assert.deepEqual(shapeBounds({ x: 10, y: 20 }, { x: -5, y: 25 }, true), {
    x: -5,
    y: 20,
    width: 15,
    height: 15,
  });
});

test("draws center-origin shapes symmetrically", () => {
  assert.deepEqual(shapeBounds({ x: 10, y: 10 }, { x: 15, y: 13 }, false, true), {
    x: 5,
    y: 7,
    width: 10,
    height: 6,
  });
  assert.deepEqual(
    buildShapePaths("line", { x: 10, y: 10 }, { x: 15, y: 13 }, { fromCenter: true })[0],
    [{ x: 5, y: 7 }, { x: 15, y: 13 }],
  );
});

test("builds closed rectangle and ellipse paths", () => {
  const rectangle = buildShapePaths("rectangle", { x: 0, y: 0 }, { x: 20, y: 10 })[0];
  const ellipse = buildShapePaths("ellipse", { x: 0, y: 0 }, { x: 20, y: 10 })[0];
  assert.deepEqual(rectangle[0], rectangle.at(-1));
  assert.equal(ellipse.length, 49);
  assert.ok(Math.abs(ellipse[0].x - ellipse.at(-1).x) < 1e-10);
  assert.ok(Math.abs(ellipse[0].y - ellipse.at(-1).y) < 1e-10);
});

test("builds an arrow as one grouped shaft and two head paths", () => {
  const paths = buildShapePaths("arrow", { x: 0, y: 0 }, { x: 40, y: 0 });
  assert.equal(paths.length, 3);
  assert.deepEqual(paths.map((path) => path[0]), [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 0 }]);
});
