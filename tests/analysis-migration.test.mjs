import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("analysis migration preserves historical results independently from boards", () => {
  const baseSql = readFileSync(join(process.cwd(), "drizzle", "0001_loose_mauler.sql"), "utf8");
  const analysisSql = readFileSync(join(process.cwd(), "drizzle", "0005_lazy_leo.sql"), "utf8");

  assert.match(baseSql, /practice_sessions_board_id_boards_id_fk[\s\S]+ON DELETE set null/);
  assert.match(analysisSql, /ADD COLUMN "analysis" jsonb/);
  assert.match(analysisSql, /INSERT INTO "practice_sessions"/);
  assert.match(analysisSql, /#>> '\{topicTest,status\}' = 'complete'/);
});
