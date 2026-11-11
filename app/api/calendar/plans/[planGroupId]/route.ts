import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { saveWeeklyCalendarPlan } from "@/lib/server/calendar/calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";
import { weeklyPlanSchema } from "../route";

export async function PATCH(request: Request, { params }: { params: Promise<{ planGroupId: string }> }) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = weeklyPlanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Check the weekly plan and try again.", 400);
    const { planGroupId } = await params;
    return NextResponse.json({ events: await saveWeeklyCalendarPlan(viewer, parsed.data, planGroupId) });
  } catch (error) {
    return routeError(error, "Could not update the weekly plan.");
  }
}
