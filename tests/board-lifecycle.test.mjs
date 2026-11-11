import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

async function boardModel() {
  const source = readFileSync(join(process.cwd(), "lib/domain/board/model.ts"), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("empty-board cleanup only accepts board documents with no strokes", async () => {
  const { createEmptyBoardDocument, isBoardDocumentEmpty } = await boardModel();
  const empty = createEmptyBoardDocument("board-1");
  assert.equal(isBoardDocumentEmpty(empty), true);
  assert.equal(isBoardDocumentEmpty({ ...empty, pages: [...empty.pages, { id: "page-2", name: "Page 2", strokes: [] }] }), true);
  assert.equal(isBoardDocumentEmpty({ ...empty, pages: [{ ...empty.pages[0], strokes: [{ id: "stroke-1" }] }] }), false);
  assert.equal(isBoardDocumentEmpty({ pages: "invalid" }), false);
  assert.equal(isBoardDocumentEmpty(null), false);
});
