import { AppShell } from "@/components/app-shell";
import { ScheduleCalendar } from "@/components/calendar/schedule-calendar";
import { isValidTimeZone, monthRangeInTimeZone } from "@/lib/domain/calendar/recurrence";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { listCalendarOccurrences } from "@/lib/server/calendar/calendar-service";
import { isGoogleCalendarConnected } from "@/lib/server/calendar/google-calendar-service";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireRolePage("/calendar", "student");
  const params = await searchParams;
  const month = validMonth(single(params.month)) ? single(params.month)! : currentMonth();
  const requestedTimeZone = single(params.timeZone);
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone) ? requestedTimeZone : "UTC";
  const range = monthRangeInTimeZone(month, timeZone);
  const [events, googleConnected] = await Promise.all([
    listCalendarOccurrences(viewer, viewer.appUserId, range.from, range.to),
    isGoogleCalendarConnected(viewer.appUserId),
  ]);

  return (
    <AppShell user={viewer} active="calendar" title="Schedule">
      <div className="px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
        <ScheduleCalendar
          events={events}
          month={month}
          timeZone={timeZone}
          timeZoneWasExplicit={Boolean(requestedTimeZone)}
          studentUserId={viewer.appUserId}
          studentName={viewer.fullName || viewer.displayName}
          googleConnected={googleConnected}
          googleStatus={single(params.googleCalendar)}
          googleMessage={single(params.googleMessage)}
        />
      </div>
    </AppShell>
  );
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validMonth(value?: string): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
