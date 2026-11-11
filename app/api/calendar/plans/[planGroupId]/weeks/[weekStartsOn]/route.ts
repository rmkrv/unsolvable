import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { saveCalendarPlanWeek } from "@/lib/server/calendar/calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";
import { weeklyPlanSchema, weeklyPlanSlotSchema } from "../../../route";

const weeklyPlanWeekSchema = weeklyPlanSchema.extend({
  slots: z.array(weeklyPlanSlotSchema).max(7),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ planGroupId: string; weekStartsOn: string }> },
) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = weeklyPlanWeekSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Check this week and try again.", 400);
    const { planGroupId, weekStartsOn } = await params;
    if (parsed.data.startsOn !== weekStartsOn) return errorResponse("invalid_input", "Week start does not match the request.", 400);
    return NextResponse.json({ events: await saveCalendarPlanWeek(viewer, planGroupId, parsed.data) });
  } catch (error) {
    return routeError(error, "Could not update this week.");
  }
}
