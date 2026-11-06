import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { PostgresBoardRepository } from "../lib/server/boards/postgres-board-repository.ts";

test("PostgreSQL board repository enforces ownership and preserves the board contract", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL is required for the PostgreSQL integration test");

  const db = drizzle(connectionString, { schema });
  const repository = new PostgresBoardRepository(db);
  const authSubject = `contract-test:${randomUUID()}`;
  const otherSubject = `contract-test:${randomUUID()}`;
  const boardId = `board-${randomUUID()}`;

  try {
    assert.equal(await repository.readForUser(authSubject), null);

    const first = await repository.saveForUser({
      userId: authSubject,
      boardId,
      stateJson: JSON.stringify({ boardId, pages: [] }),
      snapshotDataUrl: null,
    });
    assert.equal(first.eventVersion, 1);

    const second = await repository.saveForUser({
      userId: authSubject,
      boardId,
      stateJson: JSON.stringify({ boardId, pages: [{ id: "page-1" }] }),
      snapshotDataUrl: "data:image/png;base64,AA==",
    });
    assert.equal(second.eventVersion, 2);

    const stored = await repository.readForUser(authSubject);
    assert.equal(stored?.boardId, boardId);
    assert.equal(stored?.eventVersion, 2);
    assert.deepEqual(JSON.parse(stored?.stateJson ?? "{}").pages, [{ id: "page-1" }]);

    const connectedAt = await repository.markTutorConnected(authSubject);
    assert.ok(connectedAt > 0);

    const actionId = await repository.enqueueTutorAction(authSubject, boardId, { type: "say", text: "Checked." });
    assert.ok(actionId);
    const actions = await repository.readTutorActions(authSubject, boardId, 0);
    assert.equal(actions.length, 1);
    assert.deepEqual(JSON.parse(actions[0].actionJson), { type: "say", text: "Checked." });
    assert.deepEqual(await repository.readTutorActions(authSubject, boardId, actionId), []);

    assert.equal(await repository.readForUser(otherSubject), null);
    assert.equal(await repository.enqueueTutorAction(otherSubject, boardId, { type: "say" }), null);
  } finally {
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, authSubject));
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, otherSubject));
  }
});
