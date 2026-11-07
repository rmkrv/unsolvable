import { and, asc, count, eq, or } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  appUsers,
  billingAccounts,
  friendRequests,
  friendships,
  skills,
  userProfiles,
  userSkillMastery,
} from "../../../db/schema.ts";
import type {
  BillingSummary,
  HomeInsights,
  HomeOverview,
  UserIdentityInput,
  UserProfile,
  UserRepository,
} from "./user-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresUserRepository implements UserRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getProfile(identity: UserIdentityInput): Promise<UserProfile> {
    const userId = await ensureUser(this.db, identity);
    const rows = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return toProfile(rows[0], identity.suggestedDisplayName);
  }

  async updateProfile(
    identity: UserIdentityInput,
    input: Pick<UserProfile, "displayName" | "isDiscoverable">,
  ): Promise<UserProfile> {
    const userId = await ensureUser(this.db, identity);
    const now = new Date();
    const rows = await this.db
      .insert(userProfiles)
      .values({
        userId,
        displayName: input.displayName,
        isDiscoverable: input.isDiscoverable,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          displayName: input.displayName,
          isDiscoverable: input.isDiscoverable,
          updatedAt: now,
        },
      })
      .returning();
    return toProfile(rows[0], identity.suggestedDisplayName);
  }

  async getBilling(identity: UserIdentityInput): Promise<BillingSummary> {
    const userId = await ensureUser(this.db, identity);
    const rows = await this.db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.userId, userId))
      .limit(1);
    const billing = rows[0];
    if (!billing) throw new Error("BILLING_PROVISION_FAILED");
    return {
      plan: billing.plan,
      status: billing.status,
      renewsAt: billing.renewsAt?.getTime() ?? null,
      isProviderConnected: Boolean(billing.providerCustomerId),
    };
  }

  async getHomeInsights(identity: UserIdentityInput): Promise<HomeInsights> {
    const userId = await ensureUser(this.db, identity);
    return this.readHomeInsights(userId);
  }

  async getHomeOverview(identity: UserIdentityInput): Promise<HomeOverview> {
    const userId = await ensureUser(this.db, identity);
    const [profileRows, friendRows, requestRows, masteryRows] = await this.db.batch([
      this.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1),
      this.db
        .select({ value: count() })
        .from(friendships)
        .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))),
      this.db
        .select({ value: count() })
        .from(friendRequests)
        .where(and(eq(friendRequests.recipientUserId, userId), eq(friendRequests.status, "pending"))),
      this.db
        .select({
          skillId: userSkillMastery.skillId,
          skillName: skills.name,
          score: userSkillMastery.score,
          confidence: userSkillMastery.confidence,
          evidenceCount: userSkillMastery.evidenceCount,
          calculatedAt: userSkillMastery.calculatedAt,
        })
        .from(userSkillMastery)
        .innerJoin(skills, eq(skills.id, userSkillMastery.skillId))
        .where(eq(userSkillMastery.userId, userId))
        .orderBy(asc(userSkillMastery.score))
        .limit(1),
    ]);
    return {
      profile: toProfile(profileRows[0], identity.suggestedDisplayName),
      insights: toHomeInsights(friendRows, requestRows, masteryRows),
    };
  }

  private async readHomeInsights(userId: string): Promise<HomeInsights> {
    const [friendRows, requestRows, masteryRows] = await this.db.batch([
      this.db
        .select({ value: count() })
        .from(friendships)
        .where(or(eq(friendships.userAId, userId), eq(friendships.userBId, userId))),
      this.db
        .select({ value: count() })
        .from(friendRequests)
        .where(and(eq(friendRequests.recipientUserId, userId), eq(friendRequests.status, "pending"))),
      this.db
        .select({
          skillId: userSkillMastery.skillId,
          skillName: skills.name,
          score: userSkillMastery.score,
          confidence: userSkillMastery.confidence,
          evidenceCount: userSkillMastery.evidenceCount,
          calculatedAt: userSkillMastery.calculatedAt,
        })
        .from(userSkillMastery)
        .innerJoin(skills, eq(skills.id, userSkillMastery.skillId))
        .where(eq(userSkillMastery.userId, userId))
        .orderBy(asc(userSkillMastery.score))
        .limit(1),
    ]);
    return toHomeInsights(friendRows, requestRows, masteryRows);
  }
}

function toHomeInsights(
  friendRows: { value: number }[],
  requestRows: { value: number }[],
  masteryRows: Array<{
    skillId: string;
    skillName: string;
    score: number;
    confidence: number;
    evidenceCount: number;
    calculatedAt: Date;
  }>,
): HomeInsights {
    const weakSpot = masteryRows[0];
    return {
      friendCount: friendRows[0]?.value ?? 0,
      pendingRequestCount: requestRows[0]?.value ?? 0,
      weakSpot: weakSpot
        ? { ...weakSpot, calculatedAt: weakSpot.calculatedAt.getTime() }
        : null,
    };
}

async function ensureUser(db: Database, identity: UserIdentityInput): Promise<string> {
  const existing = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.authSubject, identity.authSubject))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const now = new Date();
  const rows = await db
    .insert(appUsers)
    .values({ authSubject: identity.authSubject, updatedAt: now })
    .onConflictDoUpdate({ target: appUsers.authSubject, set: { updatedAt: now } })
    .returning({ id: appUsers.id });
  const userId = rows[0]?.id;
  if (!userId) throw new Error("USER_PROVISION_FAILED");

  await db.batch([
    db
      .insert(userProfiles)
      .values({ userId, displayName: identity.suggestedDisplayName, updatedAt: now })
      .onConflictDoNothing(),
    db
      .insert(billingAccounts)
      .values({ userId, updatedAt: now })
      .onConflictDoNothing(),
  ]);
  return userId;
}

function toProfile(
  value: typeof userProfiles.$inferSelect | undefined,
  fallbackName: string,
): UserProfile {
  return {
    displayName: value?.displayName?.trim() || fallbackName,
    avatarObjectKey: value?.avatarObjectKey ?? null,
    isDiscoverable: value?.isDiscoverable ?? false,
    learningLevel: value?.learningLevel ?? null,
    learningGoal: value?.learningGoal ?? null,
    locale: value?.locale || "en",
  };
}
