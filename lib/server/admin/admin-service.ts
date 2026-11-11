import { getDb } from "@/db";
import { ResourceNotFound } from "@/lib/server/auth/authorization-errors";
import { requireAdmin } from "@/lib/server/auth/policies";
import type { AccountRole, Viewer } from "@/lib/server/auth/viewer";
import type { AdminRepository } from "./admin-repository";
import { PostgresAdminRepository } from "./postgres-admin-repository";
import { getAuditRepository, recordAuditEvent } from "./audit-service";

let repository: AdminRepository | null = null;

export function getAdminRepository(): AdminRepository {
  repository ??= new PostgresAdminRepository(getDb());
  return repository;
}

export function setAdminRepositoryForTesting(value: AdminRepository | null) {
  repository = value;
}

export function listAdminUsers(viewer: Viewer, limit = 50) {
  requireAdmin(viewer);
  return getAdminRepository().listUsers(limit);
}

export async function getAdminUser(viewer: Viewer, userId: string) {
  requireAdmin(viewer);
  const user = await getAdminRepository().getUser(userId);
  if (!user) throw new ResourceNotFound();
  return user;
}

export async function changeUserRole(viewer: Viewer, userId: string, role: AccountRole) {
  requireAdmin(viewer);
  const result = await getAdminRepository().updateRole(userId, role);
  if (!result) throw new ResourceNotFound();
  await recordAuditEvent({
    actorUserId: viewer.appUserId,
    targetUserId: userId,
    action: role === "admin"
      ? "account.admin_granted"
      : result.before.role === "admin"
        ? "account.admin_revoked"
        : "account.role_changed",
    targetType: "app_user",
    targetId: userId,
    metadata: { previousRole: result.before.role, role },
  });
  return result.after;
}

export function listAdminLinks(viewer: Viewer, limit = 50) {
  requireAdmin(viewer);
  return getAdminRepository().listLinks(limit);
}

export function listAuditEvents(viewer: Viewer, limit = 50, before?: Date) {
  requireAdmin(viewer);
  return getAuditRepository().list(limit, before);
}
