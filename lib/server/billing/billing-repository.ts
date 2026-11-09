export type BillingSummary = {
  billingAccountId: string;
  plan: string;
  status: string;
  renewsAt: number | null;
  isProviderConnected: boolean;
  isOwner: true;
};

export type EntitlementSummary = {
  subscriptionId: string;
  plan: string;
  status: string;
  renewsAt: number | null;
};

export interface BillingRepository {
  getOwnedBilling(userId: string): Promise<BillingSummary | null>;
  getEntitlements(userId: string): Promise<EntitlementSummary[]>;
}
