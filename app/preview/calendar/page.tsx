import { AppShell } from "@/components/app-shell";
import { ScheduleCalendar } from "@/components/calendar/schedule-calendar";
import type { CalendarOccurrenceView } from "@/lib/server/calendar/calendar-service";

const studentId = "11111111-1111-4111-8111-111111111111";
const planGroupId = "33333333-3333-4333-8333-333333333333";
const planStartsAt = Date.parse("2026-11-10T00:00:00Z");
const planEndsAt = Date.parse("2026-11-30T22:59:59Z");

const previewEvents: CalendarOccurrenceView[] = [
  ...weeklyOccurrences("22222222-2222-4222-8222-222222222231", "2026-11-13T15:00:00Z", "2026-11-13T16:00:00Z"),
  ...weeklyOccurrences("22222222-2222-4222-8222-222222222232", "2026-11-14T16:00:00Z", "2026-11-14T17:00:00Z"),
  ...weeklyOccurrences("22222222-2222-4222-8222-222222222233", "2026-11-15T14:00:00Z", "2026-11-15T15:00:00Z"),
  event("22222222-2222-4222-8222-222222222223", "Submit algebra assignment", "deadline", "2026-11-16T19:00:00Z", "2026-11-16T19:30:00Z", { reminderMinutes: 1440 }),
  event("22222222-2222-4222-8222-222222222225", "Linear algebra exam", "deadline", "2026-11-27T08:00:00Z", "2026-11-27T10:00:00Z", { reminderMinutes: 1440 }),
];

function weeklyOccurrences(id: string, firstStart: string, firstEnd: string) {
  return [0, 7, 14].map((dayOffset) => {
    const start = new Date(Date.parse(firstStart) + dayOffset * 86_400_000).toISOString();
    const end = new Date(Date.parse(firstEnd) + dayOffset * 86_400_000).toISOString();
    return event(id, "Exam preparation", "study_session", start, end, {
      recurrenceFrequency: "weekly",
      recurrenceEndsAt: planEndsAt,
      planGroupId,
      planStartsAt,
      planEndsAt,
    });
  });
}

export default function CalendarPreviewPage() {
  const viewer = { displayName: "Maya K.", email: "maya@example.com", fullName: "Maya Kowalska" };
  return (
    <AppShell user={viewer} active="calendar" title="Schedule">
      <div className="px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
        <ScheduleCalendar
          events={previewEvents}
          month="2026-11"
          timeZone="Europe/Warsaw"
          timeZoneWasExplicit
          studentUserId={studentId}
          studentName="Maya"
          googleConnected
          isPreview
        />
      </div>
    </AppShell>
  );
}

function event(
  id: string,
  title: string,
  kind: "study_session" | "deadline",
  start: string,
  end: string,
  options: Partial<CalendarOccurrenceView> = {},
): CalendarOccurrenceView {
  const startsAt = Date.parse(start);
  const endsAt = Date.parse(end);
  const base: CalendarOccurrenceView = {
    id,
    studentUserId: studentId,
    title,
    description: null,
    kind,
    status: "scheduled",
    startsAt,
    endsAt,
    occurrenceStart: startsAt,
    occurrenceEnd: endsAt,
    timeZone: "Europe/Warsaw",
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndsAt: null,
    reminderMinutes: 30,
    completedAt: null,
    createdByUserId: studentId,
    updatedByUserId: studentId,
    planGroupId: id,
    planStartsAt: startsAt,
    planEndsAt: Date.parse("2026-11-30T22:59:59Z"),
  };
  return { ...base, ...options } as CalendarOccurrenceView;
}
