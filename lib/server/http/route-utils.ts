import { apiErrorResponse, errorResponse } from "./api-errors";

export function routeError(error: unknown, message = "The request could not be completed.") {
  return apiErrorResponse(error) ?? errorResponse("internal_error", message, 500);
}

export function parseBoundedLimit(request: Request, fallback: number, maximum: number) {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? fallback);
  return Number.isFinite(raw) ? Math.max(1, Math.min(maximum, Math.trunc(raw))) : fallback;
}

export function parseDateCursor(request: Request): Date | undefined {
  const value = new URL(request.url).searchParams.get("before");
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const deprecationHeaders = {
  Deprecation: "true",
  Sunset: "Sun, 07 Feb 2027 00:00:00 GMT",
} as const;
