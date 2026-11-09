import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema.ts";
import { PostgresBillingRepository } from "../lib/server/billing/postgres-billing-repository.ts";
import { PostgresParentLinkRepository } from "../lib/server/parents/postgres-parent-link-repository.ts";

test("parent links and billing entitlements remain independent authorization dimensions", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "DATABASE_URL is required for the PostgreSQL integration test");
  const db = drizzle(connectionString, { schema });
  const links = new PostgresParentLinkRepository(db);
  const billing = new PostgresBillingRepository(db);
  const prefix = `rbac-test:${randomUUID()}`;
  const created = await db.insert(schema.appUsers).values([
    { authSubject: `${prefix}:parent`, role: "parent", roleConfirmedAt: new Date() },
    { authSubject: `${prefix}:student`, role: "student", roleConfirmedAt: new Date() },
    { authSubject: `${prefix}:unlinked`, role: "student", roleConfirmedAt: new Date() },
  ]).returning({ id: schema.appUsers.id, role: schema.appUsers.role });
  const parent = created.find((user) => user.role === "parent");
  const [student, unlinked] = created.filter((user) => user.role === "student");
  assert.ok(parent && student && unlinked);

  try {
    const invitation = await links.invite(parent.id, student.id, parent.id);
    assert.equal(invitation.status, "pending");
    const accepted = await links.accept(invitation.id);
    assert.equal(accepted?.status, "active");
    assert.equal((await links.listForParent(parent.id, 10))[0]?.studentId, student.id);
    assert.equal(await links.getLink(parent.id, unlinked.id), null);

    const [account] = await db.insert(schema.billingAccounts).values({ ownerUserId: parent.id }).returning();
    const [subscription] = await db.insert(schema.subscriptions).values({
      billingAccountId: account.id,
      plan: "family",
      status: "active",
    }).returning();
    await db.insert(schema.subscriptionEntitlements).values({
      subscriptionId: subscription.id,
      beneficiaryUserId: unlinked.id,
    });

    assert.equal((await billing.getOwnedBilling(parent.id))?.plan, "family");
    assert.equal(await billing.getOwnedBilling(student.id), null, "relationship does not transfer billing ownership");
    assert.equal((await billing.getEntitlements(unlinked.id))[0]?.plan, "family");
    assert.deepEqual(await billing.getEntitlements(student.id), [], "relationship does not create an entitlement");
    assert.equal(await links.getLink(parent.id, unlinked.id), null, "entitlement does not create summary access");

    const revoked = await links.revoke(parent.id, student.id);
    assert.equal(revoked?.status, "revoked");
  } finally {
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, `${prefix}:parent`));
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, `${prefix}:student`));
    await db.delete(schema.appUsers).where(eq(schema.appUsers.authSubject, `${prefix}:unlinked`));
  }
});
