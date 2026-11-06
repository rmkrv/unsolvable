import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

async function loadReturnPath() {
  const source = readFileSync(join(process.cwd(), "lib", "auth", "return-path.ts"), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("auth redirects remain same-origin and cannot loop through auth pages", async () => {
  const { safeReturnPath } = await loadReturnPath();
  assert.equal(safeReturnPath("/board?lesson=1#step"), "/board?lesson=1#step");
  assert.equal(safeReturnPath("https://attacker.example"), "/");
  assert.equal(safeReturnPath("//attacker.example"), "/");
  assert.equal(safeReturnPath("/auth/sign-in?redirectTo=/auth/sign-in"), "/");
  assert.equal(safeReturnPath(undefined), "/");
});
