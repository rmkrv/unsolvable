import type { AccountRole } from "@/lib/server/auth/viewer";

export type LinkStatus = "pending" | "active" | "revoked";

export type LinkedStudent = {
  linkId: string;
  studentId: string;
  displayName: string;
  status: LinkStatus;
  invitedAt: number;
  acceptedAt: number | null;
  revokedAt: number | null;
};

export type ParentStudentLinkRecord = {
  id: string;
  parentUserId: string;
  studentUserId: string;
  status: LinkStatus;
  invitedByUserId: string;
};

export interface ParentLinkRepository {
  getUserRole(userId: string): Promise<AccountRole | null>;
  listForParent(parentUserId: string, limit: number): Promise<LinkedStudent[]>;
  getLinkById(linkId: string): Promise<ParentStudentLinkRecord | null>;
  getLink(parentUserId: string, studentUserId: string): Promise<ParentStudentLinkRecord | null>;
  invite(parentUserId: string, studentUserId: string, invitedByUserId: string): Promise<ParentStudentLinkRecord>;
  accept(linkId: string): Promise<ParentStudentLinkRecord | null>;
  revoke(parentUserId: string, studentUserId: string): Promise<ParentStudentLinkRecord | null>;
}
