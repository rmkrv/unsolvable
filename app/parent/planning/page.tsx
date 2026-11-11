import { ScheduleCalendar } from "@/components/calendar/schedule-calendar";
import { ParentShell } from "@/components/role-shell";
import { isValidTimeZone, monthRangeInTimeZone } from "@/lib/domain/calendar/recurrence";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { listCalendarOccurrences } from "@/lib/server/calendar/calendar-service";
import { isGoogleCalendarConnected } from "@/lib/server/calendar/google-calendar-service";
import { getParentStudents } from "@/lib/server/parents/parent-dashboard-service";

export const dynamic = "force-dynamic";

export default async function ParentPlanningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await requireRolePage("/parent/planning", "parent");
  const params = await searchParams;
  const students = (await getParentStudents(viewer, 100)).filter((student) => student.status === "active");

  if (!students.length) {
    return (
      <ParentShell viewer={viewer} title="Planning">
        <div className="card card-border bg-base-100"><div className="card-body items-start"><span className="badge badge-soft">Planning</span><h2 className="card-title text-2xl">No active student link</h2><p className="max-w-xl text-base-content/60">A student must accept the parent link before either account can share schedule access.</p></div></div>
      </ParentShell>
    );
  }

  const requestedStudentId = single(params.studentId);
  const selected = students.find((student) => student.studentId === requestedStudentId) || students[0];
  const month = validMonth(single(params.month)) ? single(params.month)! : currentMonth();
  const requestedTimeZone = single(params.timeZone);
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone) ? requestedTimeZone : "UTC";
  const range = monthRangeInTimeZone(month, timeZone);
  const [events, googleConnected] = await Promise.all([
    listCalendarOccurrences(viewer, selected.studentId, range.from, range.to),
    isGoogleCalendarConnected(viewer.appUserId),
  ]);

  return (
    <ParentShell viewer={viewer} title="Planning">
      <ScheduleCalendar
        events={events}
        month={month}
        timeZone={timeZone}
        timeZoneWasExplicit={Boolean(requestedTimeZone)}
        studentUserId={selected.studentId}
        studentName={selected.displayName}
        students={students.map((student) => ({ studentId: student.studentId, displayName: student.displayName }))}
        googleConnected={googleConnected}
        googleStatus={single(params.googleCalendar)}
        googleMessage={single(params.googleMessage)}
      />
    </ParentShell>
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
