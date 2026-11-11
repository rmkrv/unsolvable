import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("RBAC migration backfills roles, subscriptions, and self-entitlements before cutover", () => {
  const sql = readFileSync(join(process.cwd(), "drizzle", "0002_freezing_ares.sql"), "utf8");
  const roleBackfill = sql.indexOf('UPDATE "app_users" SET "role_confirmed_at"');
  const subscriptionBackfill = sql.indexOf('INSERT INTO "subscriptions"');
  const entitlementBackfill = sql.indexOf('INSERT INTO "subscription_entitlements"');
  const planDrop = sql.indexOf('DROP COLUMN "plan"');

  assert.ok(roleBackfill > -1, "existing accounts must be confirmed as migrated students");
  assert.ok(subscriptionBackfill > roleBackfill, "legacy billing must become subscriptions");
  assert.ok(entitlementBackfill > subscriptionBackfill, "legacy owners must become beneficiaries");
  assert.ok(planDrop > entitlementBackfill, "legacy columns must remain until both backfills finish");
  assert.match(sql, /DROP CONSTRAINT "billing_accounts_pkey"/);
  assert.match(sql, /CREATE UNIQUE INDEX "subscriptions_billing_account_uidx"/);
});
