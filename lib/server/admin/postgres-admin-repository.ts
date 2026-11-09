import { desc, eq } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import { appUsers, parentStudentLinks, userProfiles } from "../../../db/schema.ts";
import type { AdminLinkRecord, AdminRepository, AdminUserRecord } from "./admin-repository";
import type { AccountRole } from "@/lib/server/auth/viewer";

type Database = ReturnType<typeof getDb>;

export class PostgresAdminRepository implements AdminRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async listUsers(limit: number): Promise<AdminUserRecord[]> {
    const rows = await this.userQuery()
      .orderBy(desc(appUsers.createdAt))
      .limit(Math.max(1, Math.min(100, limit)));
    return rows.map(toAdminUser);
  }

  async getUser(userId: string): Promise<AdminUserRecord | null> {
    const rows = await this.userQuery().where(eq(appUsers.id, userId)).limit(1);
    return rows[0] ? toAdminUser(rows[0]) : null;
  }

  async updateRole(
    userId: string,
    role: AccountRole,
  ): Promise<{ before: AdminUserRecord; after: AdminUserRecord } | null> {
    const before = await this.getUser(userId);
    if (!before) return null;
    const now = new Date();
    await this.db
      .update(appUsers)
      .set({ role, roleConfirmedAt: now, updatedAt: now })
      .where(eq(appUsers.id, userId));
    const after = await this.getUser(userId);
    return after ? { before, after } : null;
  }

  async listLinks(limit: number): Promise<AdminLinkRecord[]> {
    const rows = await this.db
      .select()
      .from(parentStudentLinks)
      .orderBy(desc(parentStudentLinks.updatedAt))
      .limit(Math.max(1, Math.min(100, limit)));
    return rows.map((row) => ({
      id: row.id,
      parentUserId: row.parentUserId,
      studentUserId: row.studentUserId,
      status: row.status,
      invitedAt: row.invitedAt.getTime(),
      acceptedAt: row.acceptedAt?.getTime() ?? null,
      revokedAt: row.revokedAt?.getTime() ?? null,
    }));
  }

  private userQuery() {
    return this.db
      .select({
        id: appUsers.id,
        role: appUsers.role,
        roleConfirmedAt: appUsers.roleConfirmedAt,
        displayName: userProfiles.displayName,
        createdAt: appUsers.createdAt,
      })
      .from(appUsers)
      .leftJoin(userProfiles, eq(userProfiles.userId, appUsers.id));
  }
}

function toAdminUser(row: {
  id: string;
  role: AccountRole;
  roleConfirmedAt: Date | null;
  displayName: string | null;
  createdAt: Date;
}): AdminUserRecord {
  return {
    id: row.id,
    role: row.role,
    roleConfirmedAt: row.roleConfirmedAt?.getTime() ?? null,
    displayName: row.displayName?.trim() || "Unnamed account",
    createdAt: row.createdAt.getTime(),
  };
}
