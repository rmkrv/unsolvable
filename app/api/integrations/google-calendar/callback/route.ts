import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { connectGoogleCalendar } from "@/lib/server/calendar/google-calendar-service";

const STATE_COOKIE = "unsolvable_google_calendar_oauth";

type OAuthState = { state: string; userId: string; returnTo: string };

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const rawCookie = (await cookies()).get(STATE_COOKIE)?.value;
  let saved: OAuthState | null = null;
  try {
    saved = rawCookie ? JSON.parse(rawCookie) as OAuthState : null;
  } catch {
    saved = null;
  }
  const returnTo = saved?.returnTo || "/";
  const destination = new URL(returnTo, requestUrl.origin);
  const response = (status: "connected" | "error", message?: string) => {
    destination.searchParams.set("googleCalendar", status);
    if (message) destination.searchParams.set("googleMessage", message.slice(0, 180));
    const redirect = NextResponse.redirect(destination);
    redirect.cookies.delete({ name: STATE_COOKIE, path: "/api/integrations/google-calendar/callback" });
    return redirect;
  };

  try {
    const viewer = await requireRequestViewer();
    const state = requestUrl.searchParams.get("state");
    const code = requestUrl.searchParams.get("code");
    if (!saved || !state || state !== saved.state || viewer.appUserId !== saved.userId || !code) {
      return response("error", "Google authorization could not be verified.");
    }
    const callbackUrl = new URL("/api/integrations/google-calendar/callback", requestUrl.origin).toString();
    await connectGoogleCalendar(viewer, code, callbackUrl);
    return response("connected");
  } catch (error) {
    return response("error", error instanceof Error ? error.message : "Google Calendar could not be connected.");
  }
}
