import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL_UNPOOLED or DATABASE_URL is required");
const sql = neon(databaseUrl);
const fixtureSubject = "migration-backfill-fixture";

if (process.argv[2] === "seed") {
  const users = await sql.query(
    `insert into app_users (auth_subject)
     values ($1)
     returning id`,
    [fixtureSubject],
  );
  assert.equal(users.length, 1);
  await sql.query(
    `insert into billing_accounts
       (user_id, plan, status, provider_customer_id, provider_subscription_id, renews_at)
     values ($1, 'pro', 'trialing', 'cus_migration_fixture', 'sub_migration_fixture', '2027-02-03T04:05:06Z')`,
    [users[0].id],
  );
  console.log("Seeded legacy RBAC migration fixture.");
} else if (process.argv[2] === "verify") {
  const rows = await sql.query(
    `select
       u.role,
       u.role_confirmed_at,
       b.owner_user_id,
       b.provider_customer_id,
       s.plan,
       s.status,
       s.provider_subscription_id,
       s.renews_at,
       e.beneficiary_user_id,
       e.status as entitlement_status
     from app_users u
     join billing_accounts b on b.owner_user_id = u.id
     join subscriptions s on s.billing_account_id = b.id
     join subscription_entitlements e on e.subscription_id = s.id
     where u.auth_subject = $1`,
    [fixtureSubject],
  );
  assert.equal(rows.length, 1, "legacy billing must migrate exactly once");
  const row = rows[0];
  assert.equal(row.role, "student");
  assert.ok(row.role_confirmed_at);
  assert.equal(row.plan, "pro");
  assert.equal(row.status, "trialing");
  assert.equal(row.provider_customer_id, "cus_migration_fixture");
  assert.equal(row.provider_subscription_id, "sub_migration_fixture");
  assert.equal(new Date(row.renews_at).toISOString(), "2027-02-03T04:05:06.000Z");
  assert.equal(row.beneficiary_user_id, row.owner_user_id);
  assert.equal(row.entitlement_status, "active");
  console.log("Verified legacy role, billing, and entitlement backfill.");
} else {
  throw new Error("Use: node scripts/verify-rbac-migration.mjs seed|verify");
}
