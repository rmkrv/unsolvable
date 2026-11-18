import { safeReturnPath } from "@/lib/auth/return-path";
import { auth } from "@/lib/server/auth/neon";

export type AuthIdentity = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getCurrentAuthIdentity(): Promise<AuthIdentity | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user?.id || !user.email || !user.emailVerified) return null;

  const fullName = user.name?.trim() || null;
  return {
    userId: user.id,
    displayName: fullName ?? user.email,
    email: user.email,
    fullName,
  };
}

export function signInPath(returnTo: string): string {
  return `/auth/sign-in?redirectTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/"): string {
  return `/auth/sign-out?redirectTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
