import { getDb } from "@/db";
import type { AuthenticatedUser } from "@/lib/server/auth/current-user";
import { PostgresUserRepository } from "./postgres-user-repository";
import type { UserRepository } from "./user-repository";

let repository: UserRepository | null = null;

export function getUserRepository(): UserRepository {
  repository ??= new PostgresUserRepository(getDb());
  return repository;
}

export function setUserRepositoryForTesting(value: UserRepository | null) {
  repository = value;
}

function identity(user: AuthenticatedUser) {
  return {
    authSubject: user.userId,
    suggestedDisplayName: user.fullName || user.displayName,
  };
}

export function getUserProfile(user: AuthenticatedUser) {
  return getUserRepository().getProfile(identity(user));
}

export function updateUserProfile(
  user: AuthenticatedUser,
  input: { displayName: string; isDiscoverable: boolean },
) {
  return getUserRepository().updateProfile(identity(user), input);
}

export function getUserBilling(user: AuthenticatedUser) {
  return getUserRepository().getBilling(identity(user));
}

export function getHomeInsights(user: AuthenticatedUser) {
  return getUserRepository().getHomeInsights(identity(user));
}

export function getHomeOverviewForIdentity(authSubject: string, suggestedDisplayName: string) {
  return getUserRepository().getHomeOverview({ authSubject, suggestedDisplayName });
}
