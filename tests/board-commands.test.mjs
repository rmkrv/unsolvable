import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

function moduleUrl(relativePath, replacements = new Map()) {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  let output = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const [specifier, replacement] of replacements) {
    output = output.replaceAll(`"${specifier}"`, `"${replacement}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
}

async function commandsModule() {
  const model = moduleUrl("lib/domain/board/model.ts");
  const operations = moduleUrl("lib/domain/board/operations.ts", new Map([["./model", model]]));
  return import(moduleUrl("lib/domain/board/commands.ts", new Map([["./operations", operations]])));
}

function point(x, y) {
  return { x, y, pressure: 0.5, t: 0 };
}

function draft(id, groupId) {
  return {
    id,
    points: [point(10, 20), point(20, 30)],
    color: "#3558d4",
    width: 3,
    opacity: 1,
    kind: "pen",
    groupId,
  };
}

function document() {
  return {
    boardId: "board-1",
    pages: [{ id: "page-1", name: "Page 1", strokes: [] }],
    activePageId: "page-1",
    viewport: { x: 0, y: 0, zoom: 1 },
    hintLevel: 2,
  };
}

test("agent commands add, move, and delete editable grouped strokes", async () => {
  const { applyBoardCommands } = await commandsModule();
  const actor = { id: "agent:user-1", type: "agent", onBehalfOf: "user-1" };
  const added = applyBoardCommands(document(), [
    { type: "stroke.add", pageId: "page-1", strokes: [draft("a", "group-1"), draft("b", "group-1")] },
  ], actor);
  assert.deepEqual(added.pages[0].strokes.map((stroke) => stroke.author), ["ai", "ai"]);

  const moved = applyBoardCommands(added, [
    { type: "stroke.move", pageId: "page-1", strokeIds: ["a"], dx: 5, dy: -2 },
  ], actor);
  assert.deepEqual(moved.pages[0].strokes.map((stroke) => stroke.points[0]), [point(15, 18), point(15, 18)]);
  assert.deepEqual(moved.pages[0].strokes.map((stroke) => stroke.modifiedBy), ["ai", "ai"]);

  const deleted = applyBoardCommands(moved, [
    { type: "stroke.delete", pageId: "page-1", strokeIds: ["b"] },
  ], actor);
  assert.equal(deleted.pages[0].strokes.length, 0);
});

test("human and agent commands share page and hint semantics", async () => {
  const { applyBoardCommands } = await commandsModule();
  const human = { id: "user-1", type: "human" };
  const changed = applyBoardCommands(document(), [
    { type: "page.create", pageId: "page-2", name: "Work", afterPageId: "page-1" },
    { type: "page.rename", pageId: "page-1", name: "Question" },
    { type: "hint.set", level: 4 },
    { type: "stroke.add", pageId: "page-2", strokes: [draft("student-stroke")] },
  ], human);
  assert.deepEqual(changed.pages.map((page) => page.name), ["Question", "Work"]);
  assert.equal(changed.hintLevel, 4);
  assert.equal(changed.pages[1].strokes[0].author, "student");
  assert.throws(
    () => applyBoardCommands(document(), [{ type: "page.delete", pageId: "page-1" }], human),
    /BOARD_LAST_PAGE_DELETE_REJECTED/,
  );
});

test("board commands reject unsafe coordinates and duplicate identifiers", async () => {
  const { applyBoardCommands } = await commandsModule();
  const actor = { id: "agent:user-1", type: "agent" };
  assert.throws(
    () => applyBoardCommands(document(), [{
      type: "stroke.add",
      pageId: "page-1",
      strokes: [{ ...draft("bad"), points: [point(0, 0), point(20_001, 0)] }],
    }], actor),
    /BOARD_POINT_OUT_OF_BOUNDS/,
  );
  assert.throws(
    () => applyBoardCommands(document(), [{
      type: "stroke.add",
      pageId: "page-1",
      strokes: [draft("same"), draft("same")],
    }], actor),
    /BOARD_STROKE_ID_CONFLICT/,
  );
});
