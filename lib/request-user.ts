export function requestUserId(request: Request): string | null {
  return request.headers.get("oai-authenticated-user-id");
}

export function requireRequestUserId(request: Request): string {
  const userId = requestUserId(request);
  if (!userId) throw new Error("AUTH_REQUIRED");
  return userId;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
