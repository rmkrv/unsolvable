export const ACCOUNT_ROLES = ["student", "parent", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export type Viewer = {
  authSubject: string;
  appUserId: string;
  role: AccountRole;
  roleConfirmedAt: number | null;
  email: string;
  displayName: string;
  fullName: string | null;
};

export function roleEntryPath(role: AccountRole): string {
  if (role === "parent") return "/parent";
  if (role === "admin") return "/admin";
  return "/home";
}
