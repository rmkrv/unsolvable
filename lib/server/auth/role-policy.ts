import { RoleForbidden } from "./authorization-errors.ts";
import type { AccountRole, Viewer } from "./viewer.ts";

export function requireRole(viewer: Viewer, ...roles: AccountRole[]): Viewer {
  if (viewer.roleConfirmedAt === null) {
    throw new RoleForbidden("Complete account role selection before using this feature.");
  }
  if (!roles.includes(viewer.role)) throw new RoleForbidden();
  return viewer;
}

export const requireStudent = (viewer: Viewer) => requireRole(viewer, "student");
export const requireParent = (viewer: Viewer) => requireRole(viewer, "parent");
export const requireAdmin = (viewer: Viewer) => requireRole(viewer, "admin");
