import { getDb } from "@/db";
import { Conflict, ResourceNotFound, RoleForbidden } from "@/lib/server/auth/authorization-errors";
import { requireActiveParentStudentLink, requireParent } from "@/lib/server/auth/policies";
import type { Viewer } from "@/lib/server/auth/viewer";
import { recordAuditEvent } from "@/lib/server/admin/audit-service";
import { getStudentSummaryRepository } from "@/lib/server/students/student-service";
import type { ParentLinkRepository } from "./parent-link-repository";
import { PostgresParentLinkRepository } from "./postgres-parent-link-repository";

let repository: ParentLinkRepository | null = null;

export function getParentLinkRepository(): ParentLinkRepository {
  repository ??= new PostgresParentLinkRepository(getDb());
  return repository;
}

export function setParentLinkRepositoryForTesting(value: ParentLinkRepository | null) {
  repository = value;
}

export function getParentStudents(viewer: Viewer, limit = 50) {
  requireParent(viewer);
  return getParentLinkRepository().listForParent(viewer.appUserId, limit);
}

export async function getParentHome(viewer: Viewer) {
  const students = await getParentStudents(viewer, 50);
  return {
    students,
    activeCount: students.filter((student) => student.status === "active").length,
    pendingCount: students.filter((student) => student.status === "pending").length,
  };
}

export async function inviteStudent(viewer: Viewer, studentId: string) {
  requireParent(viewer);
  const targetRole = await getParentLinkRepository().getUserRole(studentId);
  if (targetRole !== "student") throw new ResourceNotFound();
  const existing = await getParentLinkRepository().getLink(viewer.appUserId, studentId);
  if (existing?.status === "active") throw new Conflict("That student is already linked.");
  const link = await getParentLinkRepository().invite(viewer.appUserId, studentId, viewer.appUserId);
  await recordAuditEvent({
    actorUserId: viewer.appUserId,
    targetUserId: studentId,
    action: "parent_link.invited",
    targetType: "parent_student_link",
    targetId: link.id,
    metadata: { parentUserId: viewer.appUserId, studentUserId: studentId },
  });
  return link;
}

export async function acceptStudentInvitation(viewer: Viewer, invitationId: string) {
  requireParent(viewer);
  const link = await getParentLinkRepository().getLinkById(invitationId);
  if (!link || link.parentUserId !== viewer.appUserId) throw new ResourceNotFound();
  if (link.status !== "pending") throw new Conflict("That invitation is no longer pending.");
  const parentRole = await getParentLinkRepository().getUserRole(link.parentUserId);
  if (parentRole !== "parent") throw new RoleForbidden();
  const accepted = await getParentLinkRepository().accept(invitationId);
  if (!accepted) throw new Conflict("That invitation is no longer pending.");
  await recordAuditEvent({
    actorUserId: viewer.appUserId,
    targetUserId: link.studentUserId,
    action: "parent_link.accepted",
    targetType: "parent_student_link",
    targetId: link.id,
    metadata: { parentUserId: link.parentUserId, studentUserId: link.studentUserId },
  });
  return accepted;
}

export async function revokeStudentLink(viewer: Viewer, studentId: string) {
  requireParent(viewer);
  const link = await getParentLinkRepository().getLink(viewer.appUserId, studentId);
  if (!link || link.status === "revoked") throw new ResourceNotFound();
  const revoked = await getParentLinkRepository().revoke(viewer.appUserId, studentId);
  if (!revoked) throw new ResourceNotFound();
  await recordAuditEvent({
    actorUserId: viewer.appUserId,
    targetUserId: studentId,
    action: "parent_link.revoked",
    targetType: "parent_student_link",
    targetId: revoked.id,
    metadata: { parentUserId: viewer.appUserId, studentUserId: studentId },
  });
  return revoked;
}

export async function getLinkedStudentPerformance(viewer: Viewer, studentId: string) {
  requireParent(viewer);
  await requireActiveParentStudentLink(viewer.appUserId, studentId);
  return getStudentSummaryRepository().getPerformance(studentId);
}

export async function getLinkedStudentAttendance(
  viewer: Viewer,
  studentId: string,
  limit = 30,
  before?: Date,
) {
  requireParent(viewer);
  await requireActiveParentStudentLink(viewer.appUserId, studentId);
  return getStudentSummaryRepository().getAttendance(studentId, limit, before);
}
