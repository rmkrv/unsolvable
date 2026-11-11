import type { AccountRole } from "@/lib/server/auth/viewer";
import type { LinkStatus } from "@/lib/server/parents/parent-link-repository";

export type AdminUserRecord = {
  id: string;
  role: AccountRole;
  roleConfirmedAt: number | null;
  displayName: string;
  createdAt: number;
};

export type AdminLinkRecord = {
  id: string;
  parentUserId: string;
  studentUserId: string;
  status: LinkStatus;
  invitedAt: number;
  acceptedAt: number | null;
  revokedAt: number | null;
};

export interface AdminRepository {
  listUsers(limit: number): Promise<AdminUserRecord[]>;
  getUser(userId: string): Promise<AdminUserRecord | null>;
  updateRole(userId: string, role: AccountRole): Promise<{ before: AdminUserRecord; after: AdminUserRecord } | null>;
  listLinks(limit: number): Promise<AdminLinkRecord[]>;
}
