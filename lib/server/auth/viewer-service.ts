import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getCurrentAuthIdentity, signInPath } from "./current-user";
import { AuthenticationRequired, Conflict } from "./authorization-errors";
import { PostgresViewerRepository } from "./postgres-viewer-repository";
import type { ViewerRepository } from "./viewer-repository";
import { roleEntryPath, type AccountRole, type Viewer } from "./viewer";

let repository: ViewerRepository | null = null;

export function getViewerRepository(): ViewerRepository {
  repository ??= new PostgresViewerRepository(getDb());
  return repository;
}

export function setViewerRepositoryForTesting(value: ViewerRepository | null) {
  repository = value;
}

export async function getCurrentViewer(): Promise<Viewer | null> {
  const identity = await getCurrentAuthIdentity();
  if (!identity) return null;
  const record = await getViewerRepository().resolveOrProvision({
    authSubject: identity.userId,
    suggestedDisplayName: identity.fullName || identity.displayName,
  });
  return {
    ...record,
    email: identity.email,
    displayName: identity.displayName,
    fullName: identity.fullName,
  };
}

export async function requireRequestViewer(): Promise<Viewer> {
  const viewer = await getCurrentViewer();
  if (!viewer) throw new AuthenticationRequired();
  return viewer;
}

export async function requirePageViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getCurrentViewer();
  if (viewer) return viewer;
  redirect(signInPath(returnTo));
}

export async function requireRolePage(returnTo: string, role: AccountRole): Promise<Viewer> {
  const viewer = await requirePageViewer(returnTo);
  if (viewer.roleConfirmedAt === null) redirect("/onboarding");
  if (viewer.role !== role) redirect(roleEntryPath(viewer.role));
  return viewer;
}

export async function resolveViewerForAuthSubject(authSubject: string): Promise<Viewer> {
  const record = await getViewerRepository().resolveOrProvision({
    authSubject,
    suggestedDisplayName: "Unsolvable user",
  });
  return {
    ...record,
    email: "",
    displayName: "Unsolvable user",
    fullName: null,
  };
}

export async function selectPublicRole(
  viewer: Viewer,
  role: Exclude<AccountRole, "admin">,
): Promise<Viewer> {
  if (viewer.roleConfirmedAt !== null) throw new Conflict("The account role has already been confirmed.");
  const updated = await getViewerRepository().selectPublicRole(viewer.appUserId, role);
  if (!updated) throw new Conflict("The account role has already been confirmed.");
  return { ...viewer, ...updated };
}
