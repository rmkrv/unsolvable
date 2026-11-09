import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

async function policyModule() {
  const source = readFileSync(join(process.cwd(), "lib/domain/tutor/mcp-tool-policy.ts"), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("MCP observation and verification tools are read-only and closed-world", async () => {
  const { boardToolAnnotations } = await policyModule();
  for (const name of ["observe_board", "verify_arithmetic_equation", "verify_math_step"]) {
    assert.deepEqual(boardToolAnnotations(name), {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  }
});

test("MCP board mutations retain write and destructive safety hints", async () => {
  const { boardToolAnnotations } = await policyModule();
  assert.equal(boardToolAnnotations("board_add_strokes").readOnlyHint, false);
  assert.equal(boardToolAnnotations("board_add_strokes").destructiveHint, false);
  assert.equal(boardToolAnnotations("board_delete_strokes").destructiveHint, true);
  assert.equal(boardToolAnnotations("board_manage_page").destructiveHint, true);
  assert.equal(boardToolAnnotations("board_erase").destructiveHint, true);
  assert.equal(boardToolAnnotations("board_set_hint_level").idempotentHint, true);
});
