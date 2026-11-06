import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/auth/return-path";
import { auth } from "@/lib/server/auth/neon";

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user?.id || !user.email) return null;

  const fullName = user.name?.trim() || null;
  return {
    userId: user.id,
    displayName: fullName ?? user.email,
    email: user.email,
    fullName,
  };
}

export async function requireCurrentUser(returnTo: string): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string): string {
  return `/auth/sign-in?redirectTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/"): string {
  return `/auth/sign-out?redirectTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
