import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { PostgresUserRepository } from "../lib/server/users/postgres-user-repository.ts";

test("PostgreSQL user repository provisions and persists product-owned account data", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL is required for the PostgreSQL integration test");

  const db = drizzle(connectionString, { schema });
  const repository = new PostgresUserRepository(db);
  const identity = {
    authSubject: `profile-test:${randomUUID()}`,
    suggestedDisplayName: "Initial Learner",
  };

  try {
    const initial = await repository.getProfile(identity);
    assert.equal(initial.displayName, "Initial Learner");
    assert.equal(initial.isDiscoverable, false);

    const updated = await repository.updateProfile(identity, {
      displayName: "Ada Learner",
      isDiscoverable: true,
    });
    assert.equal(updated.displayName, "Ada Learner");
    assert.equal(updated.isDiscoverable, true);

    const billing = await repository.getBilling(identity);
    assert.equal(billing.plan, "free");
    assert.equal(billing.status, "active");
    assert.equal(billing.isProviderConnected, false);

    const home = await repository.getHomeInsights(identity);
    assert.deepEqual(home, { friendCount: 0, pendingRequestCount: 0, weakSpot: null });

    const overview = await repository.getHomeOverview(identity);
    assert.equal(overview.profile.displayName, "Ada Learner");
    assert.deepEqual(overview.insights, home);
  } finally {
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, identity.authSubject));
  }
});
