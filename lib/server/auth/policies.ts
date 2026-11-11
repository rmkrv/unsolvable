import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { billingAccounts, boardMembers, parentStudentLinks } from "@/db/schema";
import { ResourceNotFound } from "./authorization-errors";
export { requireAdmin, requireParent, requireRole, requireStudent } from "./role-policy";

export async function requireActiveParentStudentLink(parentId: string, studentId: string) {
  const rows = await getDb()
    .select({ id: parentStudentLinks.id })
    .from(parentStudentLinks)
    .where(and(
      eq(parentStudentLinks.parentUserId, parentId),
      eq(parentStudentLinks.studentUserId, studentId),
      eq(parentStudentLinks.status, "active"),
    ))
    .limit(1);
  if (!rows[0]) throw new ResourceNotFound();
  return rows[0];
}

export async function requireBillingOwner(viewerId: string, billingAccountId: string) {
  const rows = await getDb()
    .select({ id: billingAccounts.id })
    .from(billingAccounts)
    .where(and(eq(billingAccounts.id, billingAccountId), eq(billingAccounts.ownerUserId, viewerId)))
    .limit(1);
  if (!rows[0]) throw new ResourceNotFound();
  return rows[0];
}

export async function requireBoardMembership(viewerId: string, boardId: string) {
  const rows = await getDb()
    .select({ role: boardMembers.role })
    .from(boardMembers)
    .where(and(eq(boardMembers.userId, viewerId), eq(boardMembers.boardId, boardId)))
    .limit(1);
  if (!rows[0]) throw new ResourceNotFound();
  return rows[0];
}
