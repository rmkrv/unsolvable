import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : statSync(path).isFile() ? [path] : [];
  });
}

test("domain code does not depend on client, server, framework, or cloud adapters", () => {
  const files = sourceFiles(join(process.cwd(), "lib", "domain"));
  const forbidden = [
    /lib[\\/]client/,
    /lib[\\/]server/,
    /from ["']next(?:\/|["'])/,
    /from ["']cloudflare:/,
    /from ["']drizzle-orm/,
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${file} crosses the domain boundary via ${pattern}`);
    }
  }
});

test("the board component delegates board HTTP transport to the client adapter", () => {
  const source = readFileSync(join(process.cwd(), "components", "tutor-board.tsx"), "utf8");
  assert.equal(/\bfetch\s*\(/.test(source), false);
  assert.match(source, /createHttpBoardGateway/);
  assert.match(source, /createTutorTransport/);
  assert.doesNotMatch(source, /node:child_process|spawn\(/);
});
