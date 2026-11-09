import type { AccountRole } from "@/lib/server/auth/viewer";

export type AccountProfile = {
  displayName: string;
  avatarObjectKey: string | null;
  isDiscoverable: boolean;
  learningLevel: string | null;
  learningGoal: string | null;
  locale: string;
};

export type AccountSummary = {
  id: string;
  role: AccountRole;
  roleConfirmed: boolean;
  email: string;
  profile: AccountProfile;
};

export interface AccountRepository {
  getProfile(userId: string, fallbackName: string): Promise<AccountProfile>;
  updateProfile(
    userId: string,
    input: Pick<AccountProfile, "displayName" | "isDiscoverable">,
  ): Promise<AccountProfile>;
}
