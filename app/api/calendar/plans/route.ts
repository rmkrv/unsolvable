import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import { saveWeeklyCalendarPlan } from "@/lib/server/calendar/calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export const weeklyPlanSlotSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(15).max(240),
}).strict();

export const weeklyPlanSchema = z.object({
  studentUserId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().min(1).max(100),
  reminderMinutes: z.number().int().min(0).max(40320),
  slots: z.array(weeklyPlanSlotSchema).min(1).max(7),
}).strict();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = weeklyPlanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Check the weekly plan and try again.", 400);
    return NextResponse.json({ events: await saveWeeklyCalendarPlan(viewer, parsed.data) }, { status: 201 });
  } catch (error) {
    return routeError(error, "Could not create the weekly plan.");
  }
}
