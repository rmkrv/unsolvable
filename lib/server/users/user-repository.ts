export type UserIdentityInput = {
  authSubject: string;
  suggestedDisplayName: string;
};

export type UserProfile = {
  displayName: string;
  avatarObjectKey: string | null;
  isDiscoverable: boolean;
  learningLevel: string | null;
  learningGoal: string | null;
  locale: string;
};

export type BillingSummary = {
  plan: string;
  status: string;
  renewsAt: number | null;
  isProviderConnected: boolean;
};

export type WeakSpotSummary = {
  skillId: string;
  skillName: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  calculatedAt: number;
};

export type HomeInsights = {
  friendCount: number;
  pendingRequestCount: number;
  weakSpot: WeakSpotSummary | null;
};

export type HomeOverview = {
  profile: UserProfile;
  insights: HomeInsights;
};

export interface UserRepository {
  getProfile(identity: UserIdentityInput): Promise<UserProfile>;
  updateProfile(identity: UserIdentityInput, input: Pick<UserProfile, "displayName" | "isDiscoverable">): Promise<UserProfile>;
  getBilling(identity: UserIdentityInput): Promise<BillingSummary>;
  getHomeInsights(identity: UserIdentityInput): Promise<HomeInsights>;
  getHomeOverview(identity: UserIdentityInput): Promise<HomeOverview>;
}
