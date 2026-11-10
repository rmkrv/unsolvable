import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth/return-path";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { googleCalendarAuthorizationUrl } from "@/lib/server/calendar/google-calendar-service";
import { routeError } from "@/lib/server/http/route-utils";

const STATE_COOKIE = "unsolvable_google_calendar_oauth";

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    const requestUrl = new URL(request.url);
    const state = crypto.randomUUID();
    const returnTo = safeReturnPath(requestUrl.searchParams.get("returnTo"));
    const callbackUrl = new URL("/api/integrations/google-calendar/callback", requestUrl.origin).toString();
    const response = NextResponse.redirect(googleCalendarAuthorizationUrl(callbackUrl, state));
    response.cookies.set(STATE_COOKIE, JSON.stringify({ state, userId: viewer.appUserId, returnTo }), {
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      path: "/api/integrations/google-calendar/callback",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return routeError(error, "Could not start Google Calendar authorization.");
  }
}
