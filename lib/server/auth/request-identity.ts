import { getCurrentUser } from "@/lib/server/auth/current-user";

export async function requestUserId(): Promise<string | null> {
  return (await getCurrentUser())?.userId ?? null;
}

export async function requireRequestUserId(): Promise<string> {
  const userId = await requestUserId();
  if (!userId) throw new Error("AUTH_REQUIRED");
  return userId;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
