import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { updateCalendarEvent } from "@/lib/server/calendar/calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";
import { calendarEventSchema, toDraft } from "../route";

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = calendarEventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Check the event details and try again.", 400);
    const { eventId } = await params;
    return NextResponse.json({ event: await updateCalendarEvent(viewer, eventId, toDraft(parsed.data)) });
  } catch (error) {
    return routeError(error, "Could not update the event.");
  }
}
