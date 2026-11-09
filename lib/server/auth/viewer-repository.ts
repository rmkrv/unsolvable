import type { AccountRole } from "./viewer";

export type ViewerIdentityInput = {
  authSubject: string;
  suggestedDisplayName: string;
};

export type ApplicationViewerRecord = {
  appUserId: string;
  authSubject: string;
  role: AccountRole;
  roleConfirmedAt: number | null;
};

export interface ViewerRepository {
  resolveOrProvision(input: ViewerIdentityInput): Promise<ApplicationViewerRecord>;
  selectPublicRole(appUserId: string, role: Exclude<AccountRole, "admin">): Promise<ApplicationViewerRecord | null>;
}
