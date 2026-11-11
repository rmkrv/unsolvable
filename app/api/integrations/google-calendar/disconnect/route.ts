import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { disconnectGoogleCalendar } from "@/lib/server/calendar/google-calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    await disconnectGoogleCalendar(viewer);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return routeError(error, "Could not disconnect Google Calendar.");
  }
}
