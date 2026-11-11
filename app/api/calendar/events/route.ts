import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import {
  createCalendarEvent,
  listCalendarOccurrences,
  type CalendarEventDraft,
} from "@/lib/server/calendar/calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

export const calendarEventSchema = z.object({
  studentUserId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  kind: z.enum(["study_session", "deadline"]),
  status: z.enum(["scheduled", "completed", "cancelled"]),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  timeZone: z.string().min(1).max(100),
  recurrenceFrequency: z.enum(["daily", "weekly", "monthly"]).nullable(),
  recurrenceInterval: z.number().int().min(1).max(30),
  recurrenceEndsAt: z.iso.datetime({ offset: true }).nullable(),
  reminderMinutes: z.number().int().min(0).max(40320),
}).strict();

export async function GET(request: Request) {
  try {
    const viewer = await requireRequestViewer();
    const url = new URL(request.url);
    const studentUserId = url.searchParams.get("studentId") || (viewer.role === "student" ? viewer.appUserId : "");
    const from = new Date(url.searchParams.get("from") || "");
    const to = new Date(url.searchParams.get("to") || "");
    if (!studentUserId || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return errorResponse("invalid_input", "studentId, from, and to are required.", 400);
    }
    return NextResponse.json({ events: await listCalendarOccurrences(viewer, studentUserId, from, to) });
  } catch (error) {
    return routeError(error, "Could not load the schedule.");
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = calendarEventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Check the event details and try again.", 400);
    const event = await createCalendarEvent(viewer, toDraft(parsed.data));
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return routeError(error, "Could not create the event.");
  }
}

export function toDraft(input: z.infer<typeof calendarEventSchema>): CalendarEventDraft {
  return {
    ...input,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    recurrenceEndsAt: input.recurrenceEndsAt ? new Date(input.recurrenceEndsAt) : null,
  };
}
