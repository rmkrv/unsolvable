import { getCurrentViewer, requireRequestViewer } from "@/lib/server/auth/viewer-service";
import type { Viewer } from "@/lib/server/auth/viewer";

export async function requestUserId(): Promise<string | null> {
  return (await getCurrentViewer())?.appUserId ?? null;
}

export async function requireRequestUserId(): Promise<string> {
  return (await requireRequestViewer()).appUserId;
}

export function requireViewer(): Promise<Viewer> {
  return requireRequestViewer();
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
