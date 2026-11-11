import { getDb } from "@/db";
import type { Viewer } from "@/lib/server/auth/viewer";
import { PostgresAccountRepository } from "./postgres-account-repository";
import type { AccountRepository, AccountSummary } from "./account-repository";

let repository: AccountRepository | null = null;

export function getAccountRepository(): AccountRepository {
  repository ??= new PostgresAccountRepository(getDb());
  return repository;
}

export function setAccountRepositoryForTesting(value: AccountRepository | null) {
  repository = value;
}

export async function getAccount(viewer: Viewer): Promise<AccountSummary> {
  const profile = await getAccountRepository().getProfile(viewer.appUserId, displayNameFor(viewer));
  return {
    id: viewer.appUserId,
    role: viewer.role,
    roleConfirmed: viewer.roleConfirmedAt !== null,
    email: viewer.email,
    profile,
  };
}

export function getAccountProfile(viewer: Viewer) {
  return getAccountRepository().getProfile(viewer.appUserId, displayNameFor(viewer));
}

export function updateAccountProfile(
  viewer: Viewer,
  input: { displayName: string; isDiscoverable: boolean },
) {
  return getAccountRepository().updateProfile(viewer.appUserId, input);
}

function displayNameFor(viewer: Viewer) {
  return viewer.fullName || viewer.displayName;
}
