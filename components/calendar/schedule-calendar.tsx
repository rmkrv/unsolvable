"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  CloudUpload,
  Pencil,
  Repeat2,
  X,
} from "lucide-react";
import type { CalendarOccurrenceView } from "@/lib/server/calendar/calendar-service";

type LinkedStudentOption = { studentId: string; displayName: string };

export function ScheduleCalendar({
  events,
  month,
  timeZone,
  timeZoneWasExplicit,
  studentUserId,
  studentName,
  students,
  googleConnected,
  googleStatus,
  googleMessage,
  isPreview = false,
}: {
  events: CalendarOccurrenceView[];
  month: string;
  timeZone: string;
  timeZoneWasExplicit: boolean;
  studentUserId: string;
  studentName: string;
  students?: LinkedStudentOption[];
  googleConnected: boolean;
  googleStatus?: string;
  googleMessage?: string;
  isPreview?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<CalendarOccurrenceView | null>(null);
  const [selectedDate, setSelectedDate] = useState(`${month}-01`);
  const [editorScope, setEditorScope] = useState<"month" | "week">("month");
  const [dialogRevision, setDialogRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    googleStatus === "connected" ? "Google Calendar connected." : googleMessage || null,
  );

  useEffect(() => {
    if (timeZoneWasExplicit) return;
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimeZone || browserTimeZone === timeZone) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("timeZone", browserTimeZone);
    router.replace(`${pathname}?${params}`);
  }, [pathname, router, searchParams, timeZone, timeZoneWasExplicit]);

  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);
  const grouped = useMemo(() => groupByDay(events, timeZone), [events, timeZone]);
  const monthPlanEvent = events.find((event) => event.kind === "study_session" && event.planGroupId) ?? null;
  const monthPlanEvents = monthPlanEvent?.planGroupId
    ? events.filter((event) => event.planGroupId === monthPlanEvent.planGroupId)
    : [];
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month}-01T12:00:00Z`));

  useEffect(() => {
    if (!dialogRevision) return;
    dialogRef.current?.showModal();
  }, [dialogRevision, editorScope, selected, selectedDate]);

  const navigate = (nextMonth: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonth);
    params.set("timeZone", timeZone);
    router.push(`${pathname}?${params}`);
  };

  const openMonthPlan = () => {
    setEditorScope("month");
    setSelected(monthPlanEvent);
    setSelectedDate(monthPlanEvent
      ? dateKey(monthPlanEvent.planStartsAt ?? monthPlanEvent.startsAt, monthPlanEvent.timeZone)
      : defaultPlanStart(month));
    setDialogRevision((revision) => revision + 1);
  };

  const openWeek = (date: string) => {
    if (!monthPlanEvent) {
      setNotice("Create the repeating weekly plan with the button above first.");
      return;
    }
    const weekStartsOn = startOfWeek(date);
    const weekEndsOn = addDateDays(weekStartsOn, 6);
    const planStartsOn = dateKey(monthPlanEvent.planStartsAt ?? monthPlanEvent.startsAt, monthPlanEvent.timeZone);
    const planEndsOn = dateKey(monthPlanEvent.planEndsAt ?? monthPlanEvent.recurrenceEndsAt ?? monthPlanEvent.endsAt, monthPlanEvent.timeZone);
    if (weekEndsOn < planStartsOn || weekStartsOn > planEndsOn) {
      setNotice("That week falls outside the current plan. Use the button above to change the month-wide plan.");
      return;
    }
    setEditorScope("week");
    setSelected(monthPlanEvent);
    setSelectedDate(weekStartsOn);
    setDialogRevision((revision) => revision + 1);
  };

  const connectGoogle = () => {
    const returnTo = `${pathname}?${searchParams.toString()}`;
    router.push(`/api/integrations/google-calendar/connect?returnTo=${encodeURIComponent(returnTo)}`);
  };

  async function exportToGoogle(payload: Record<string, unknown>, key: string) {
    if (isPreview) {
      setNotice("Google Calendar export is available in a signed-in workspace.");
      return;
    }
    if (!googleConnected) {
      connectGoogle();
      return;
    }
    setBusy(key);
    setNotice(null);
    try {
      const response = await fetch("/api/calendar/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as {
        result?: { exported: number; updated: number; skipped: number };
        error?: { message?: string };
      };
      if (!response.ok || !body.result) throw new Error(body.error?.message || "Google Calendar export failed.");
      const parts = [
        body.result.exported ? `${body.result.exported} added` : "",
        body.result.updated ? `${body.result.updated} updated` : "",
      ].filter(Boolean);
      setNotice(parts.length ? `${parts.join(", ")} in Google Calendar.` : "Nothing needed exporting.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Google Calendar export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <header className="flex flex-col gap-5 border-b border-base-300 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-soft">Schedule</span>
            {isPreview && <span className="badge badge-outline">Design preview</span>}
            <span className={`badge badge-soft ${googleConnected ? "badge-success" : ""}`}>
              <Cloud size={13} /> {googleConnected ? "Google connected" : "Google not connected"}
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Plan the work, then do it.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/60">
            Use the button for {studentName}’s repeating weekly rhythm. Click a date when only that Monday–Sunday week needs to be different.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => exportToGoogle({ scope: "month", studentUserId, month, timeZone }, "month")}
            disabled={busy !== null}
          >
            <CloudUpload size={17} /> {busy === "month" ? "Exporting…" : "Add month to Google"}
          </button>
          <button className="btn btn-primary" type="button" onClick={openMonthPlan}>
            <CalendarPlus size={17} /> {monthPlanEvent ? "Edit weekly schedule" : "Plan weekly schedule"}
          </button>
        </div>
      </header>

      {notice && (
        <div className={`alert mt-5 ${googleStatus === "error" ? "alert-error" : "alert-info"}`} role="alert">
          <Cloud size={18} /><span>{notice}</span>
          <button className="btn btn-ghost btn-sm btn-square" type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={16} /></button>
        </div>
      )}

      {students && (
        <section className="card card-border mt-6 bg-base-100">
          <div className="card-body flex-row items-center justify-between gap-4 py-4">
            <div><h3 className="card-title text-base">Student schedule</h3><p className="text-sm text-base-content/55">Parents can read, create, and edit plans for active links.</p></div>
            <select
              className="select w-full max-w-64"
              aria-label="Choose student"
              value={studentUserId}
              onChange={(event) => {
                const params = new URLSearchParams(searchParams.toString());
                params.set("studentId", event.target.value);
                router.push(`${pathname}?${params}`);
              }}
            >
              {students.map((student) => <option key={student.studentId} value={student.studentId}>{student.displayName}</option>)}
            </select>
          </div>
        </section>
      )}

      <section className="mt-6" aria-labelledby="month-heading">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">Monthly plan</p>
            <h3 id="month-heading" className="mt-1 text-2xl font-semibold">{monthLabel}</h3>
          </div>
          <div className="join">
            <button className="btn btn-square join-item" type="button" onClick={() => navigate(offsetMonth(month, -1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <button className="btn join-item" type="button" onClick={() => navigate(currentMonth())}>Today</button>
            <button className="btn btn-square join-item" type="button" onClick={() => navigate(offsetMonth(month, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-box border border-base-300 bg-base-100 md:block">
          <div className="grid grid-cols-7 border-b border-base-300 bg-base-200/60">
            {WEEKDAYS.map((day) => <div className="px-3 py-2 text-xs font-semibold text-base-content/50" key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayEvents = grouped.get(day.key) || [];
              return (
                <div
                  className={`min-h-36 border-b border-r border-base-300 p-2 transition-colors ${day.inMonth ? "cursor-pointer hover:bg-primary/4" : "bg-base-200/35 text-base-content/35"}`}
                  key={day.key}
                  onClick={day.inMonth ? () => openWeek(day.key) : undefined}
                >
                  <div className="mb-2 flex items-center justify-between">
                    {day.inMonth ? (
                      <button className={`btn btn-ghost btn-xs btn-circle ${day.today ? "bg-neutral text-neutral-content hover:bg-neutral" : ""}`} type="button" aria-label={`Edit only the week containing ${day.key}`} onClick={(event) => { event.stopPropagation(); openWeek(day.key); }}>{day.day}</button>
                    ) : <span className="flex size-7 items-center justify-center text-xs font-semibold">{day.day}</span>}
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.slice(0, 4).map((event) => (
                      <CalendarEventChip
                        key={`${event.id}-${event.occurrenceStart}`}
                        event={event}
                        busy={busy}
                        onEdit={() => openWeek(dateKey(event.occurrenceStart, event.timeZone))}
                        onExport={() => exportToGoogle({ scope: "event", eventId: event.id, occurrenceStart: new Date(event.occurrenceStart).toISOString() }, `${event.id}-${event.occurrenceStart}`)}
                      />
                    ))}
                    {dayEvents.length > 4 && <p className="px-1 text-[0.68rem] text-base-content/50">+{dayEvents.length - 4} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card card-border mb-4 bg-base-100 md:hidden">
          <div className="card-body gap-3 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/50">Choose a week to adjust</p>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((day) => <span className="py-1 text-[0.65rem] font-semibold text-base-content/40" key={day}>{day.slice(0, 1)}</span>)}
              {calendarDays.map((day) => <button className={`btn btn-sm btn-square ${day.inMonth ? "btn-ghost" : "btn-ghost opacity-25"}`} key={day.key} type="button" disabled={!day.inMonth} aria-label={day.inMonth ? `Edit only the week containing ${day.key}` : undefined} onClick={() => openWeek(day.key)}>{day.day}</button>)}
            </div>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {Array.from(grouped.entries()).filter(([key]) => key.startsWith(month)).map(([key, dayEvents]) => (
            <article className="card card-border bg-base-100" key={key}>
              <div className="card-body gap-3 p-4">
                <h4 className="text-sm font-semibold">{formatDayHeading(key)}</h4>
                {dayEvents.map((event) => (
                  <CalendarEventRow
                    key={`${event.id}-${event.occurrenceStart}`}
                    event={event}
                    busy={busy}
                    onEdit={() => openWeek(dateKey(event.occurrenceStart, event.timeZone))}
                    onExport={() => exportToGoogle({ scope: "event", eventId: event.id, occurrenceStart: new Date(event.occurrenceStart).toISOString() }, `${event.id}-${event.occurrenceStart}`)}
                  />
                ))}
              </div>
            </article>
          ))}
          {!events.length && <EmptySchedule />}
        </div>
      </section>

      <WeeklyPlanDialog
        key={`${editorScope}-${selected?.planGroupId ?? "new"}-${selectedDate}`}
        dialogRef={dialogRef}
        scope={editorScope}
        event={selected}
        relatedEvents={editorScope === "month"
          ? monthPlanEvents
          : monthPlanEvents.filter((event) => {
              const key = dateKey(event.occurrenceStart, event.timeZone);
              return key >= selectedDate && key <= addDateDays(selectedDate, 6);
            })}
        startsOn={selectedDate}
        studentUserId={studentUserId}
        timeZone={timeZone}
        onSaved={() => { dialogRef.current?.close(); router.refresh(); setNotice(editorScope === "week" ? "That week was updated. The other weeks are unchanged." : selected ? "Weekly schedule updated." : "Weekly schedule created."); }}
        isPreview={isPreview}
      />
    </div>
  );
}

function CalendarEventChip({ event, busy, onEdit, onExport }: EventActions) {
  const key = `${event.id}-${event.occurrenceStart}`;
  return (
    <div className={`group rounded-selector border px-2 py-1.5 text-xs ${event.kind === "deadline" ? "border-warning/30 bg-warning/10" : "border-primary/20 bg-primary/8"}`}>
      <div className="flex items-start gap-1">
        <button className="min-w-0 flex-1 text-left" type="button" onClick={(click) => { click.stopPropagation(); onEdit(); }}>
          <span className="block truncate font-semibold">{event.title}</span>
          <span className="mt-0.5 block text-[0.65rem] text-base-content/55">{formatTime(event.occurrenceStart, event.timeZone)}</span>
        </button>
        {event.kind === "study_session" && (
          <button className="btn btn-ghost btn-xs btn-square" type="button" onClick={(click) => { click.stopPropagation(); onExport(); }} disabled={busy !== null} aria-label={`Add ${event.title} to Google Calendar`} title="Add to Google Calendar">
            <CloudUpload size={13} className={busy === key ? "animate-pulse" : ""} />
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarEventRow({ event, busy, onEdit, onExport }: EventActions) {
  const key = `${event.id}-${event.occurrenceStart}`;
  return (
    <div className="flex items-center gap-3 rounded-box border border-base-300 p-3">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-box ${event.kind === "deadline" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
        {event.status === "completed" ? <Check size={18} /> : <Clock3 size={18} />}
      </div>
      <button className="min-w-0 flex-1 text-left" type="button" onClick={onEdit}>
        <span className="block truncate font-semibold">{event.title}</span>
        <span className="mt-1 block text-xs text-base-content/55">{formatTime(event.occurrenceStart, event.timeZone)}–{formatTime(event.occurrenceEnd, event.timeZone)} · {event.kind === "deadline" ? "Deadline" : "Study session"}</span>
      </button>
      <button className="btn btn-ghost btn-sm btn-square" type="button" onClick={onEdit} aria-label={`Edit ${event.title}`}><Pencil size={16} /></button>
      {event.kind === "study_session" && <button className="btn btn-sm" type="button" onClick={onExport} disabled={busy !== null}><CloudUpload size={15} /> <span className="hidden sm:inline">Google</span>{busy === key && <span className="loading loading-spinner loading-xs" />}</button>}
    </div>
  );
}

function WeeklyPlanDialog({ dialogRef, scope, event, relatedEvents, startsOn, studentUserId, timeZone, onSaved, isPreview }: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  scope: "month" | "week";
  event: CalendarOccurrenceView | null;
  relatedEvents: CalendarOccurrenceView[];
  startsOn: string;
  studentUserId: string;
  timeZone: string;
  onSaved: () => void;
  isPreview: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialSlots = event ? planSlots(relatedEvents) : [{ weekday: weekdayOf(startsOn), startTime: "16:00", durationMinutes: 60 }];
  const [slots, setSlots] = useState<PlanSlotState[]>(initialSlots);
  const planStartsOn = event ? dateKey(event.planStartsAt ?? event.startsAt, event.timeZone) : startsOn;
  const planEndsOn = event ? dateKey(event.planEndsAt ?? event.recurrenceEndsAt ?? event.endsAt, event.timeZone) : endOfMonth(startsOn);
  const endsOn = scope === "week" ? addDateDays(startsOn, 6) : planEndsOn;
  const editableStartsOn = scope === "week" && startsOn < planStartsOn ? planStartsOn : startsOn;
  const editableEndsOn = scope === "week" && endsOn > planEndsOn ? planEndsOn : endsOn;
  const allowedWeekdays = weekdaysInRange(editableStartsOn, editableEndsOn);
  const defaults = {
    title: event?.title || "Weekly study plan",
    description: event?.description || "",
    reminderMinutes: String(event?.reminderMinutes ?? 30),
  };

  function toggleWeekday(weekday: number) {
    setSlots((current) => current.some((slot) => slot.weekday === weekday)
      ? current.filter((slot) => slot.weekday !== weekday)
      : [...current, { weekday, startTime: "16:00", durationMinutes: 60 }].sort((a, b) => weekdayOrder(a.weekday) - weekdayOrder(b.weekday)));
  }

  function updateSlot(weekday: number, patch: Partial<PlanSlotState>) {
    setSlots((current) => current.map((slot) => slot.weekday === weekday ? { ...slot, ...patch } : slot));
  }

  async function submit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (scope === "month" && !slots.length) { setError("Choose at least one weekday."); return; }
    setSaving(true);
    setError(null);
    const form = new FormData(formEvent.currentTarget);
    try {
      const payload = {
        studentUserId,
        title: String(form.get("title")),
        description: String(form.get("description") || "") || null,
        startsOn,
        timeZone: event?.timeZone || timeZone,
        reminderMinutes: Number(form.get("reminderMinutes")),
        slots,
      };
      const planGroupId = event?.planGroupId;
      const endpoint = scope === "week" && planGroupId
        ? `/api/calendar/plans/${planGroupId}/weeks/${startsOn}`
        : planGroupId ? `/api/calendar/plans/${planGroupId}` : "/api/calendar/plans";
      const response = await fetch(endpoint, {
        method: planGroupId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "The weekly plan could not be saved.");
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The weekly plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="modal modal-bottom sm:modal-middle" onClose={() => setError(null)}>
      <div className="modal-box max-w-3xl">
        <form method="dialog"><button className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3" aria-label="Close weekly plan editor"><X size={17} /></button></form>
        <div className="pr-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">{scope === "week" ? "This week only" : event ? "Edit repeating plan" : "New repeating plan"}</p>
          <h3 className="mt-2 text-2xl font-semibold">{scope === "week" ? "Adjust this week" : "Set a rhythm for the month"}</h3>
          <p className="mt-1 text-sm text-base-content/55">{scope === "week"
            ? `${formatDateLabel(startsOn)}–${formatDateLabel(endsOn)}. Every other week stays unchanged.`
            : `Runs from ${formatDateLabel(startsOn)} through ${formatDateLabel(endsOn)}. Each weekday can have its own time.`}</p>
        </div>

        <form className="mt-6 grid gap-5" onSubmit={submit}>
          <fieldset className="fieldset"><legend className="fieldset-legend">Plan name</legend><input className="input w-full" name="title" defaultValue={defaults.title} maxLength={120} required /></fieldset>
          <fieldset className="fieldset"><legend className="fieldset-legend">What are you working on?</legend><input className="input w-full" name="description" defaultValue={defaults.description} maxLength={2000} placeholder="Calculus review, exam preparation…" /></fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Study days</legend>
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const active = slots.some((slot) => slot.weekday === day.value);
                const allowed = allowedWeekdays.has(day.value);
                return <button className={`btn btn-circle btn-sm sm:btn-md ${active ? "btn-neutral" : "btn-outline"}`} key={day.value} type="button" disabled={!allowed} aria-label={`${active ? "Remove" : "Add"} ${day.label}`} aria-pressed={active} onClick={() => toggleWeekday(day.value)}>{day.short}</button>;
              })}
            </div>
          </fieldset>

          <div className="rounded-box border border-base-300 bg-base-200/45">
            <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-3 border-b border-base-300 px-4 py-2 text-xs font-semibold text-base-content/45 sm:grid"><span>Day</span><span>Start</span><span>Duration</span><span /></div>
            {slots.map((slot) => (
              <div className="grid gap-3 border-b border-base-300 p-4 last:border-b-0 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center" key={slot.weekday}>
                <div><span className="font-semibold">{WEEKDAY_OPTIONS.find((day) => day.value === slot.weekday)?.label}</span><span className="ml-2 text-xs text-base-content/45 sm:hidden">weekly</span></div>
                <select className="select w-full" aria-label={`Start time on ${weekdayName(slot.weekday)}`} value={slot.startTime} onChange={(change) => updateSlot(slot.weekday, { startTime: change.target.value })}>{TIME_OPTIONS.map((time) => <option key={time} value={time}>{formatClockTime(time)}</option>)}</select>
                <select className="select w-full" aria-label={`Duration on ${weekdayName(slot.weekday)}`} value={slot.durationMinutes} onChange={(change) => updateSlot(slot.weekday, { durationMinutes: Number(change.target.value) })}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select>
                <button className="btn btn-ghost btn-sm btn-square" type="button" onClick={() => toggleWeekday(slot.weekday)} aria-label={`Remove ${weekdayName(slot.weekday)}`}><X size={16} /></button>
              </div>
            ))}
            {!slots.length && <p className="p-5 text-center text-sm text-base-content/50">{scope === "week" ? "No sessions this week. Saving will skip this week." : "Choose one or more study days above."}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="fieldset"><legend className="fieldset-legend">Reminder</legend><select className="select w-full" name="reminderMinutes" defaultValue={defaults.reminderMinutes}><option value="0">At start time</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></fieldset>
            <fieldset className="fieldset"><legend className="fieldset-legend">Time zone</legend><input className="input w-full" value={event?.timeZone || timeZone} readOnly /></fieldset>
          </div>

          <div className="alert alert-info" role="alert"><Repeat2 size={18} /><span>{scope === "week" ? "Only this Monday–Sunday week will change." : "This repeating plan updates every selected weekday through the end of the month."}</span></div>
          {error && <div className="alert alert-error" role="alert"><span>{error}</span></div>}
          <div className="modal-action">
            <button className="btn" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button className="btn btn-primary" type="submit" disabled={saving || isPreview}>{saving && <span className="loading loading-spinner loading-sm" />} {isPreview ? "Sign in to save" : saving ? "Saving…" : scope === "week" ? "Save this week" : "Save repeating plan"}</button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop"><button>Close weekly plan editor</button></form>
    </dialog>
  );
}

function EmptySchedule() {
  return <div className="card card-border bg-base-100"><div className="card-body items-center py-10 text-center"><CalendarPlus className="text-base-content/35" size={30} /><h4 className="card-title">No weekly plan yet</h4><p className="text-sm text-base-content/55">Tap a date above to build this month’s study rhythm.</p></div></div>;
}

type EventActions = {
  event: CalendarOccurrenceView;
  busy: string | null;
  onEdit: () => void;
  onExport: () => void;
};

type PlanSlotState = { weekday: number; startTime: string; durationMinutes: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_OPTIONS = [
  { value: 1, short: "M", label: "Monday" },
  { value: 2, short: "T", label: "Tuesday" },
  { value: 3, short: "W", label: "Wednesday" },
  { value: 4, short: "T", label: "Thursday" },
  { value: 5, short: "F", label: "Friday" },
  { value: 6, short: "S", label: "Saturday" },
  { value: 0, short: "S", label: "Sunday" },
];
const TIME_OPTIONS = Array.from({ length: 37 }, (_, index) => {
  const minutes = 5 * 60 + index * 30;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

function buildCalendarDays(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, monthIndex - 1, 1 - startOffset));
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    const key = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    return { key, day: date.getUTCDate(), inMonth: date.getUTCMonth() === monthIndex - 1, today: key === todayKey };
  });
}

function groupByDay(events: CalendarOccurrenceView[], timeZone: string) {
  const groups = new Map<string, CalendarOccurrenceView[]>();
  for (const event of events) {
    const key = dateKey(event.occurrenceStart, timeZone);
    const group = groups.get(key) || [];
    group.push(event);
    groups.set(key, group);
  }
  return groups;
}

function dateKey(value: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTime(value: number, timeZone: string) {
  return new Intl.DateTimeFormat("en", { timeZone, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDayHeading(key: string) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
}

function formatLocalInput(value: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function planSlots(events: CalendarOccurrenceView[]): PlanSlotState[] {
  const unique = new Map<number, CalendarOccurrenceView>();
  for (const event of [...events].sort((left, right) => left.occurrenceStart - right.occurrenceStart)) {
    const weekday = weekdayOf(dateKey(event.occurrenceStart, event.timeZone));
    if (!unique.has(weekday)) unique.set(weekday, event);
  }
  return Array.from(unique.values()).map((event) => ({
    weekday: weekdayOf(dateKey(event.occurrenceStart, event.timeZone)),
    startTime: formatLocalInput(event.occurrenceStart, event.timeZone).slice(11),
    durationMinutes: Math.round((event.occurrenceEnd - event.occurrenceStart) / 60_000),
  })).sort((a, b) => weekdayOrder(a.weekday) - weekdayOrder(b.weekday));
}

function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function weekdayOrder(weekday: number) {
  return weekday === 0 ? 6 : weekday - 1;
}

function weekdayName(weekday: number) {
  return WEEKDAY_OPTIONS.find((day) => day.value === weekday)?.label || "Day";
}

function endOfMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(day)}`;
}

function startOfWeek(date: string) {
  const weekday = weekdayOf(date);
  return addDateDays(date, -(weekday === 0 ? 6 : weekday - 1));
}

function addDateDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function weekdaysInRange(from: string, to: string) {
  const result = new Set<number>();
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end) {
    result.add(cursor.getUTCDay());
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function formatClockTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2020, 0, 1, hour, minute)));
}

function offsetMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function defaultPlanStart(month: string) {
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return today.startsWith(`${month}-`) ? today : `${month}-01`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
