import { and, eq } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  billingAccounts,
  subscriptionEntitlements,
  subscriptions,
} from "../../../db/schema.ts";
import type {
  BillingRepository,
  BillingSummary,
  EntitlementSummary,
} from "./billing-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresBillingRepository implements BillingRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getOwnedBilling(userId: string): Promise<BillingSummary | null> {
    const rows = await this.db
      .select({
        billingAccountId: billingAccounts.id,
        providerCustomerId: billingAccounts.providerCustomerId,
        accountStatus: billingAccounts.status,
        plan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        renewsAt: subscriptions.renewsAt,
      })
      .from(billingAccounts)
      .leftJoin(subscriptions, eq(subscriptions.billingAccountId, billingAccounts.id))
      .where(eq(billingAccounts.ownerUserId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      billingAccountId: row.billingAccountId,
      plan: row.plan ?? "free",
      status: row.subscriptionStatus ?? row.accountStatus,
      renewsAt: row.renewsAt?.getTime() ?? null,
      isProviderConnected: Boolean(row.providerCustomerId),
      isOwner: true,
    };
  }

  async getEntitlements(userId: string): Promise<EntitlementSummary[]> {
    const rows = await this.db
      .select({
        subscriptionId: subscriptions.id,
        plan: subscriptions.plan,
        subscriptionStatus: subscriptions.status,
        entitlementStatus: subscriptionEntitlements.status,
        renewsAt: subscriptions.renewsAt,
      })
      .from(subscriptionEntitlements)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionEntitlements.subscriptionId))
      .where(and(
        eq(subscriptionEntitlements.beneficiaryUserId, userId),
        eq(subscriptionEntitlements.status, "active"),
      ))
      .limit(50);
    return rows.map((row) => ({
      subscriptionId: row.subscriptionId,
      plan: row.plan,
      status: row.subscriptionStatus,
      renewsAt: row.renewsAt?.getTime() ?? null,
    }));
  }
}
