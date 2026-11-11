import { and, eq, isNull } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  appUsers,
  billingAccounts,
  subscriptionEntitlements,
  subscriptions,
  userProfiles,
} from "../../../db/schema.ts";
import type {
  ApplicationViewerRecord,
  ViewerIdentityInput,
  ViewerRepository,
} from "./viewer-repository";
import type { AccountRole } from "./viewer";

type Database = ReturnType<typeof getDb>;

export class PostgresViewerRepository implements ViewerRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async resolveOrProvision(input: ViewerIdentityInput): Promise<ApplicationViewerRecord> {
    const now = new Date();
    const inserted = await this.db
      .insert(appUsers)
      .values({ authSubject: input.authSubject, updatedAt: now })
      .onConflictDoNothing({ target: appUsers.authSubject })
      .returning();
    const user = inserted[0] ?? (await this.db
      .select()
      .from(appUsers)
      .where(eq(appUsers.authSubject, input.authSubject))
      .limit(1))[0];
    if (!user) throw new Error("USER_PROVISION_FAILED");

    await this.db
      .insert(userProfiles)
      .values({ userId: user.id, displayName: input.suggestedDisplayName, updatedAt: now })
      .onConflictDoNothing({ target: userProfiles.userId });

    const insertedAccounts = await this.db
      .insert(billingAccounts)
      .values({ ownerUserId: user.id, updatedAt: now })
      .onConflictDoNothing({ target: billingAccounts.ownerUserId })
      .returning({ id: billingAccounts.id });
    const billingAccount = insertedAccounts[0] ?? (await this.db
      .select({ id: billingAccounts.id })
      .from(billingAccounts)
      .where(eq(billingAccounts.ownerUserId, user.id))
      .limit(1))[0];
    if (!billingAccount) throw new Error("BILLING_PROVISION_FAILED");

    const insertedSubscriptions = await this.db
      .insert(subscriptions)
      .values({ billingAccountId: billingAccount.id, updatedAt: now })
      .onConflictDoNothing({ target: subscriptions.billingAccountId })
      .returning({ id: subscriptions.id });
    const subscription = insertedSubscriptions[0] ?? (await this.db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.billingAccountId, billingAccount.id))
      .limit(1))[0];
    if (!subscription) throw new Error("SUBSCRIPTION_PROVISION_FAILED");

    await this.db
      .insert(subscriptionEntitlements)
      .values({ subscriptionId: subscription.id, beneficiaryUserId: user.id, updatedAt: now })
      .onConflictDoNothing({
        target: [subscriptionEntitlements.subscriptionId, subscriptionEntitlements.beneficiaryUserId],
      });

    return toViewerRecord(user);
  }

  async selectPublicRole(
    appUserId: string,
    role: Exclude<AccountRole, "admin">,
  ): Promise<ApplicationViewerRecord | null> {
    const now = new Date();
    const rows = await this.db
      .update(appUsers)
      .set({ role, roleConfirmedAt: now, updatedAt: now })
      .where(and(eq(appUsers.id, appUserId), isNull(appUsers.roleConfirmedAt)))
      .returning();
    return rows[0] ? toViewerRecord(rows[0]) : null;
  }
}

function toViewerRecord(user: typeof appUsers.$inferSelect): ApplicationViewerRecord {
  return {
    appUserId: user.id,
    authSubject: user.authSubject,
    role: user.role,
    roleConfirmedAt: user.roleConfirmedAt?.getTime() ?? null,
  };
}
