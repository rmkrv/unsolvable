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
    const [user] = await db.insert(schema.appUsers).values({ authSubject }).returning({ id: schema.appUsers.id });
    const [otherUser] = await db.insert(schema.appUsers).values({ authSubject: otherSubject }).returning({ id: schema.appUsers.id });
    assert.ok(user?.id && otherUser?.id);
    const userId = user.id;
    const otherUserId = otherUser.id;
    assert.equal(await repository.readForUser(userId), null);

    const first = await repository.saveForUser({
      userId,
      boardId,
      stateJson: JSON.stringify({ boardId, pages: [] }),
      snapshotDataUrl: null,
      title: "Integration board",
    });
    assert.equal(first.eventVersion, 1);

    const second = await repository.saveForUser({
      userId,
      boardId,
      stateJson: JSON.stringify({ boardId, pages: [{ id: "page-1" }] }),
      snapshotDataUrl: "data:image/png;base64,AA==",
    });
    assert.equal(second.eventVersion, 2);

    const stored = await repository.readForUser(userId);
    assert.equal(stored?.boardId, boardId);
    assert.equal(stored?.title, "Integration board");
    assert.equal(stored?.eventVersion, 2);
    assert.equal(stored?.snapshotDataUrl, null, "ordinary reads should not transfer the PNG snapshot");
    assert.deepEqual(JSON.parse(stored?.stateJson ?? "{}").pages, [{ id: "page-1" }]);

    const withSnapshot = await repository.readForUser(userId, boardId, true);
    assert.equal(withSnapshot?.snapshotDataUrl, "data:image/png;base64,AA==");

    assert.equal(await repository.markOpened(userId, boardId), true);
    const recent = await repository.listForUser(userId, 5);
    assert.equal(recent.length, 1);
    assert.equal(recent[0].title, "Integration board");
    assert.equal(recent[0].boardId, boardId);

    const third = await repository.updateForUser({
      userId,
      boardId,
      expectedVersion: 2,
      stateJson: JSON.stringify({ boardId, pages: [{ id: "page-2" }] }),
      snapshotDataUrl: null,
      title: "Renamed board",
    });
    assert.equal(third?.eventVersion, 3);
    assert.equal((await repository.readForUser(userId, boardId))?.title, "Renamed board");
    assert.equal(await repository.updateForUser({
      userId,
      boardId,
      expectedVersion: 2,
      stateJson: JSON.stringify({ boardId, pages: [] }),
      snapshotDataUrl: null,
    }), null, "stale writers must not overwrite a newer board version");

    const connectedAt = await repository.markTutorConnected(userId, boardId);
    assert.ok(connectedAt > 0);

    const actionId = await repository.enqueueTutorAction(userId, boardId, { type: "say", text: "Checked." });
    assert.ok(actionId);
    const actions = await repository.readTutorActions(userId, boardId, 0);
    assert.equal(actions.length, 1);
    assert.deepEqual(JSON.parse(actions[0].actionJson), { type: "say", text: "Checked." });
    assert.deepEqual(await repository.readTutorActions(userId, boardId, actionId), []);

    assert.equal(await repository.readForUser(otherUserId), null);
    assert.equal(await repository.markOpened(otherUserId, boardId), false);
    assert.equal(await repository.enqueueTutorAction(otherUserId, boardId, { type: "say" }), null);
    assert.equal(await repository.deleteForUser(otherUserId, boardId), false, "non-owners cannot delete a board");
    assert.equal(await repository.deleteForUser(userId, boardId), true, "owners can delete a non-empty board");
    assert.equal(await repository.readForUser(userId, boardId), null);
  } finally {
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, authSubject));
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, otherSubject));
  }
});
