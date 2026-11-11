import { and, desc, eq } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import { appUsers, parentStudentLinks, userProfiles } from "../../../db/schema.ts";
import type {
  LinkedStudent,
  ParentLinkRepository,
  ParentStudentLinkRecord,
} from "./parent-link-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresParentLinkRepository implements ParentLinkRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getUserRole(userId: string) {
    const rows = await this.db
      .select({ role: appUsers.role })
      .from(appUsers)
      .where(eq(appUsers.id, userId))
      .limit(1);
    return rows[0]?.role ?? null;
  }

  async listForParent(parentUserId: string, limit: number): Promise<LinkedStudent[]> {
    const rows = await this.db
      .select({
        linkId: parentStudentLinks.id,
        studentId: parentStudentLinks.studentUserId,
        displayName: userProfiles.displayName,
        status: parentStudentLinks.status,
        invitedAt: parentStudentLinks.invitedAt,
        acceptedAt: parentStudentLinks.acceptedAt,
        revokedAt: parentStudentLinks.revokedAt,
      })
      .from(parentStudentLinks)
      .innerJoin(appUsers, eq(appUsers.id, parentStudentLinks.studentUserId))
      .leftJoin(userProfiles, eq(userProfiles.userId, appUsers.id))
      .where(and(
        eq(parentStudentLinks.parentUserId, parentUserId),
        eq(appUsers.role, "student"),
      ))
      .orderBy(desc(parentStudentLinks.updatedAt))
      .limit(Math.max(1, Math.min(100, limit)));
    return rows.map((row) => ({
      linkId: row.linkId,
      studentId: row.studentId,
      displayName: row.displayName?.trim() || "Student",
      status: row.status,
      invitedAt: row.invitedAt.getTime(),
      acceptedAt: row.acceptedAt?.getTime() ?? null,
      revokedAt: row.revokedAt?.getTime() ?? null,
    }));
  }

  async getLinkById(linkId: string): Promise<ParentStudentLinkRecord | null> {
    const rows = await this.db
      .select()
      .from(parentStudentLinks)
      .where(eq(parentStudentLinks.id, linkId))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async getLink(parentUserId: string, studentUserId: string): Promise<ParentStudentLinkRecord | null> {
    const rows = await this.db
      .select()
      .from(parentStudentLinks)
      .where(and(
        eq(parentStudentLinks.parentUserId, parentUserId),
        eq(parentStudentLinks.studentUserId, studentUserId),
      ))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async invite(
    parentUserId: string,
    studentUserId: string,
    invitedByUserId: string,
  ): Promise<ParentStudentLinkRecord> {
    const now = new Date();
    const rows = await this.db
      .insert(parentStudentLinks)
      .values({ parentUserId, studentUserId, invitedByUserId, invitedAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [parentStudentLinks.parentUserId, parentStudentLinks.studentUserId],
        set: {
          status: "pending",
          invitedByUserId,
          invitedAt: now,
          acceptedAt: null,
          revokedAt: null,
          updatedAt: now,
        },
      })
      .returning();
    if (!rows[0]) throw new Error("PARENT_LINK_INVITE_FAILED");
    return toRecord(rows[0]);
  }

  async accept(linkId: string): Promise<ParentStudentLinkRecord | null> {
    const now = new Date();
    const rows = await this.db
      .update(parentStudentLinks)
      .set({ status: "active", acceptedAt: now, revokedAt: null, updatedAt: now })
      .where(and(eq(parentStudentLinks.id, linkId), eq(parentStudentLinks.status, "pending")))
      .returning();
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async revoke(parentUserId: string, studentUserId: string): Promise<ParentStudentLinkRecord | null> {
    const now = new Date();
    const rows = await this.db
      .update(parentStudentLinks)
      .set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(and(
        eq(parentStudentLinks.parentUserId, parentUserId),
        eq(parentStudentLinks.studentUserId, studentUserId),
      ))
      .returning();
    return rows[0] ? toRecord(rows[0]) : null;
  }
}

function toRecord(row: typeof parentStudentLinks.$inferSelect): ParentStudentLinkRecord {
  return {
    id: row.id,
    parentUserId: row.parentUserId,
    studentUserId: row.studentUserId,
    status: row.status,
    invitedByUserId: row.invitedByUserId,
  };
}
