import { eq } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import { userProfiles } from "../../../db/schema.ts";
import type { AccountProfile, AccountRepository } from "./account-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresAccountRepository implements AccountRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getProfile(userId: string, fallbackName: string): Promise<AccountProfile> {
    const rows = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return toProfile(rows[0], fallbackName);
  }

  async updateProfile(
    userId: string,
    input: Pick<AccountProfile, "displayName" | "isDiscoverable">,
  ): Promise<AccountProfile> {
    const now = new Date();
    const rows = await this.db
      .insert(userProfiles)
      .values({ userId, ...input, updatedAt: now })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { ...input, updatedAt: now },
      })
      .returning();
    return toProfile(rows[0], input.displayName);
  }
}

function toProfile(value: typeof userProfiles.$inferSelect | undefined, fallbackName: string): AccountProfile {
  return {
    displayName: value?.displayName?.trim() || fallbackName,
    avatarObjectKey: value?.avatarObjectKey ?? null,
    isDiscoverable: value?.isDiscoverable ?? false,
    learningLevel: value?.learningLevel ?? null,
    learningGoal: value?.learningGoal ?? null,
    locale: value?.locale || "en",
  };
}
