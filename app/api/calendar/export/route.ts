import { NextResponse } from "next/server";
import { z } from "zod";
import { monthRangeInTimeZone } from "@/lib/domain/calendar/recurrence";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { requireRequestViewer } from "@/lib/server/auth/viewer-service";
import {
  exportCalendarMonth,
  exportCalendarOccurrence,
} from "@/lib/server/calendar/google-calendar-service";
import { errorResponse } from "@/lib/server/http/api-errors";
import { routeError } from "@/lib/server/http/route-utils";

const exportSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("event"),
    eventId: z.string().uuid(),
    occurrenceStart: z.iso.datetime({ offset: true }),
  }).strict(),
  z.object({
    scope: z.literal("month"),
    studentUserId: z.string().uuid(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    timeZone: z.string().min(1).max(100),
  }).strict(),
]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse("cross_origin", "Cross-origin write rejected.", 403);
  try {
    const viewer = await requireRequestViewer();
    const parsed = exportSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("invalid_input", "Invalid Google Calendar export request.", 400);
    const result = parsed.data.scope === "event"
      ? await exportCalendarOccurrence(viewer, parsed.data.eventId, new Date(parsed.data.occurrenceStart))
      : await exportCalendarMonth(
          viewer,
          parsed.data.studentUserId,
          monthRangeInTimeZone(parsed.data.month, parsed.data.timeZone).from,
          monthRangeInTimeZone(parsed.data.month, parsed.data.timeZone).to,
        );
    return NextResponse.json({ result });
  } catch (error) {
    return routeError(error, "Could not export to Google Calendar.");
  }
}
