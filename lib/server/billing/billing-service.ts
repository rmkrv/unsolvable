import { getDb } from "@/db";
import type { Viewer } from "@/lib/server/auth/viewer";
import { Conflict, ResourceNotFound } from "@/lib/server/auth/authorization-errors";
import type { BillingRepository } from "./billing-repository";
import { PostgresBillingRepository } from "./postgres-billing-repository";

let repository: BillingRepository | null = null;

export function getBillingRepository(): BillingRepository {
  repository ??= new PostgresBillingRepository(getDb());
  return repository;
}

export function setBillingRepositoryForTesting(value: BillingRepository | null) {
  repository = value;
}

export async function getBilling(viewer: Viewer) {
  const billing = await getBillingRepository().getOwnedBilling(viewer.appUserId);
  if (!billing) throw new ResourceNotFound("Billing account not found.");
  return billing;
}

export function getEntitlements(viewer: Viewer) {
  return getBillingRepository().getEntitlements(viewer.appUserId);
}

export async function createBillingPortalSession(viewer: Viewer) {
  const billing = await getBilling(viewer);
  if (!billing.isProviderConnected) {
    throw new Conflict("Connect a billing provider before opening the billing portal.");
  }
  throw new Conflict("The billing provider portal is not configured for this deployment.");
}
