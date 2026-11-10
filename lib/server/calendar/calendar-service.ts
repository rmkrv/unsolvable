import { getDb } from "@/db";
import {
  expandCalendarEvents,
  isValidTimeZone,
  type CalendarOccurrence,
} from "@/lib/domain/calendar/recurrence";
import { buildWeeklyPlanSchedule, buildWeeklyPlanWeekSchedule } from "@/lib/domain/calendar/weekly-plan";
import { recordAuditEvent } from "@/lib/server/admin/audit-service";
import { InvalidInput, ResourceForbidden, ResourceNotFound, RoleForbidden } from "@/lib/server/auth/authorization-errors";
import { requireActiveParentStudentLink } from "@/lib/server/auth/policies";
import type { Viewer } from "@/lib/server/auth/viewer";
import type {
  CalendarEventKind,
  CalendarEventRecord,
  CalendarEventStatus,
  CalendarRepository,
  SaveCalendarEventInput,
} from "./calendar-repository";
import { PostgresCalendarRepository } from "./postgres-calendar-repository";

export type CalendarEventDraft = {
  studentUserId: string;
  title: string;
  description?: string | null;
  kind: CalendarEventKind;
  status: CalendarEventStatus;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  recurrenceFrequency: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval: number;
  recurrenceEndsAt: Date | null;
  reminderMinutes: number;
};

export type WeeklyPlanSlotDraft = {
  weekday: number;
  startTime: string;
  durationMinutes: number;
};

export type WeeklyPlanDraft = {
  studentUserId: string;
  title: string;
  description?: string | null;
  startsOn: string;
  timeZone: string;
  reminderMinutes: number;
  slots: WeeklyPlanSlotDraft[];
};

export type CalendarOccurrenceView = {
  id: string;
  studentUserId: string;
  title: string;
  description: string | null;
  kind: CalendarEventKind;
  status: CalendarEventStatus;
  startsAt: number;
  endsAt: number;
  occurrenceStart: number;
  occurrenceEnd: number;
  timeZone: string;
  recurrenceFrequency: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval: number;
  recurrenceEndsAt: number | null;
  reminderMinutes: number;
  completedAt: number | null;
  createdByUserId: string;
  updatedByUserId: string;
  planGroupId: string | null;
  planStartsAt: number | null;
  planEndsAt: number | null;
};

let repository: CalendarRepository | null = null;

export function getCalendarRepository(): CalendarRepository {
  repository ??= new PostgresCalendarRepository(getDb());
  return repository;
}

export function setCalendarRepositoryForTesting(value: CalendarRepository | null) {
  repository = value;
}

export async function listCalendarOccurrences(
  viewer: Viewer,
  studentUserId: string,
  from: Date,
  to: Date,
): Promise<CalendarOccurrenceView[]> {
  await requireCalendarAccess(viewer, studentUserId);
  if (!(from < to) || to.getTime() - from.getTime() > 93 * 86_400_000) {
    throw new InvalidInput("Calendar ranges must be 93 days or shorter.");
  }
  const sources = await getCalendarRepository().listEventSources(studentUserId, from, to);
  return expandCalendarEvents(sources, from, to).map(toView);
}

export async function createCalendarEvent(viewer: Viewer, draft: CalendarEventDraft) {
  await requireCalendarAccess(viewer, draft.studentUserId);
  const input = validateDraft(viewer, draft);
  const event = await getCalendarRepository().createEvent(input);
  await recordCalendarAudit(viewer, event, "calendar_event.created");
  return event;
}

export async function updateCalendarEvent(viewer: Viewer, eventId: string, draft: CalendarEventDraft) {
  const existing = await getCalendarRepository().getEvent(eventId);
  if (!existing) throw new ResourceNotFound("Calendar event not found.");
  if (draft.studentUserId !== existing.studentUserId) {
    throw new ResourceForbidden("A calendar event cannot be moved to another student.");
  }
  await requireCalendarAccess(viewer, existing.studentUserId);
  const updated = await getCalendarRepository().updateEvent(eventId, validateDraft(viewer, draft, existing));
  if (!updated) throw new ResourceNotFound("Calendar event not found.");
  await recordCalendarAudit(viewer, updated, "calendar_event.updated");
  return updated;
}

export async function saveWeeklyCalendarPlan(
  viewer: Viewer,
  draft: WeeklyPlanDraft,
  planGroupId?: string,
) {
  await requireCalendarAccess(viewer, draft.studentUserId);
  const existing = planGroupId ? await getCalendarRepository().listPlanEvents(planGroupId) : [];
  if (planGroupId && !existing.length) throw new ResourceNotFound("Weekly plan not found.");
  if (existing.some((event) => event.studentUserId !== draft.studentUserId)) throw new ResourceForbidden();

  const groupId = planGroupId ?? crypto.randomUUID();
  const inputs = validateWeeklyPlan(viewer, draft, groupId);
  const created = await getCalendarRepository().createEvents(inputs);
  if (created.length !== inputs.length) throw new Error("CALENDAR_PLAN_CREATE_FAILED");
  if (existing.length) await getCalendarRepository().deleteEvents(existing.map((event) => event.id));
  await recordCalendarAudit(viewer, created[0], existing.length ? "calendar_plan.updated" : "calendar_plan.created");
  return created;
}

export async function saveCalendarPlanWeek(
  viewer: Viewer,
  planGroupId: string,
  draft: WeeklyPlanDraft,
) {
  const existing = await getCalendarRepository().listPlanEvents(planGroupId);
  if (!existing.length) throw new ResourceNotFound("Weekly plan not found.");
  const studentUserId = existing[0].studentUserId;
  if (draft.studentUserId !== studentUserId || existing.some((event) => event.studentUserId !== studentUserId)) {
    throw new ResourceForbidden();
  }
  await requireCalendarAccess(viewer, studentUserId);
  if (draft.timeZone !== existing[0].timeZone || existing.some((event) => event.timeZone !== existing[0].timeZone)) {
    throw new InvalidInput("A weekly override must use the plan time zone.");
  }

  const planStartsAt = existing.find((event) => event.planStartsAt)?.planStartsAt ?? earliest(existing.map((event) => event.startsAt));
  const planEndsAt = existing.find((event) => event.planEndsAt)?.planEndsAt ?? latest(existing.map((event) => event.recurrenceEndsAt ?? event.endsAt));
  const planStartsOn = localDateKey(planStartsAt, draft.timeZone);
  const planEndsOn = localDateKey(planEndsAt, draft.timeZone);
  const week = validateWeeklyPlanWeek(draft, planStartsOn, planEndsOn);
  const weekStart = week.effectiveStartsOn;
  const weekEnd = week.effectiveEndsOn;

  const occurrences = expandCalendarEvents(existing, planStartsAt, new Date(planEndsAt.getTime() + 1_000));
  const preserved = occurrences.filter((event) => {
    const key = localDateKey(event.occurrenceStart, event.timeZone);
    return key < weekStart || key > weekEnd;
  }).map((event): SaveCalendarEventInput => ({
    actorUserId: viewer.appUserId,
    studentUserId,
    title: event.title,
    description: event.description,
    kind: event.kind,
    status: event.status,
    startsAt: event.occurrenceStart,
    endsAt: event.occurrenceEnd,
    timeZone: event.timeZone,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndsAt: null,
    reminderMinutes: event.reminderMinutes,
    completedAt: event.completedAt,
    planGroupId,
    planStartsAt,
    planEndsAt,
  }));

  const title = draft.title.trim();
  const replacement = week.slots.map((slot): SaveCalendarEventInput => ({
    actorUserId: viewer.appUserId,
    studentUserId,
    title,
    description: draft.description?.trim() || null,
    kind: "study_session",
    status: "scheduled",
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    timeZone: draft.timeZone,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceEndsAt: null,
    reminderMinutes: draft.reminderMinutes,
    completedAt: null,
    planGroupId,
    planStartsAt,
    planEndsAt,
  }));

  const inputs = [...preserved, ...replacement];
  const created = await getCalendarRepository().createEvents(inputs);
  if (created.length !== inputs.length) throw new Error("CALENDAR_PLAN_WEEK_CREATE_FAILED");
  await getCalendarRepository().deleteEvents(existing.map((event) => event.id));
  await recordCalendarAudit(viewer, created[0] ?? existing[0], "calendar_plan.week_updated");
  return created;
}

export async function getAuthorizedCalendarEvent(viewer: Viewer, eventId: string) {
  const event = await getCalendarRepository().getEvent(eventId);
  if (!event) throw new ResourceNotFound("Calendar event not found.");
  await requireCalendarAccess(viewer, event.studentUserId);
  return event;
}

export async function requireCalendarAccess(viewer: Viewer, studentUserId: string) {
  if (viewer.role === "student") {
    if (viewer.appUserId !== studentUserId) throw new ResourceForbidden();
    return;
  }
  if (viewer.role === "parent") {
    await requireActiveParentStudentLink(viewer.appUserId, studentUserId);
    return;
  }
  throw new RoleForbidden("Administrators do not edit learner schedules.");
}

export function occurrenceForStart(event: CalendarEventRecord, occurrenceStart: Date) {
  const duration = Math.max(1, event.endsAt.getTime() - event.startsAt.getTime());
  const matches = expandCalendarEvents(
    [event],
    new Date(occurrenceStart.getTime() - duration),
    new Date(occurrenceStart.getTime() + duration),
    10,
  );
  return matches.find((candidate) => candidate.occurrenceStart.getTime() === occurrenceStart.getTime()) ?? null;
}

function validateDraft(
  viewer: Viewer,
  draft: CalendarEventDraft,
  existing?: CalendarEventRecord,
): SaveCalendarEventInput {
  const title = draft.title.trim();
  if (!title || title.length > 120) throw new InvalidInput("Event titles must be between 1 and 120 characters.");
  if (draft.description && draft.description.length > 2000) throw new InvalidInput("Event descriptions are too long.");
  if (!isValidTimeZone(draft.timeZone)) throw new InvalidInput("Choose a valid IANA time zone.");
  if (!(draft.startsAt < draft.endsAt)) throw new InvalidInput("The event must end after it starts.");
  if (draft.endsAt.getTime() - draft.startsAt.getTime() > 7 * 86_400_000) {
    throw new InvalidInput("Calendar events cannot be longer than seven days.");
  }
  const recurrenceInterval = Math.trunc(draft.recurrenceInterval);
  if (recurrenceInterval < 1 || recurrenceInterval > 30) throw new InvalidInput("Invalid recurrence interval.");
  if (draft.recurrenceFrequency && (!draft.recurrenceEndsAt || draft.recurrenceEndsAt < draft.startsAt)) {
    throw new InvalidInput("Recurring events need an end date after the first session.");
  }
  if (draft.recurrenceEndsAt && draft.recurrenceEndsAt.getTime() - draft.startsAt.getTime() > 366 * 86_400_000) {
    throw new InvalidInput("Recurring plans can cover at most one year.");
  }
  if (!Number.isInteger(draft.reminderMinutes) || draft.reminderMinutes < 0 || draft.reminderMinutes > 40320) {
    throw new InvalidInput("Invalid reminder time.");
  }

  return {
    actorUserId: viewer.appUserId,
    studentUserId: draft.studentUserId,
    title,
    description: draft.description?.trim() || null,
    kind: draft.kind,
    status: draft.status,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timeZone: draft.timeZone,
    recurrenceFrequency: draft.recurrenceFrequency,
    recurrenceInterval,
    recurrenceEndsAt: draft.recurrenceFrequency ? draft.recurrenceEndsAt : null,
    reminderMinutes: draft.reminderMinutes,
    completedAt: draft.status === "completed" ? existing?.completedAt ?? new Date() : null,
    planGroupId: existing?.planGroupId ?? null,
    planStartsAt: existing?.planStartsAt ?? null,
    planEndsAt: existing?.planEndsAt ?? null,
  };
}

function validateWeeklyPlan(viewer: Viewer, draft: WeeklyPlanDraft, planGroupId: string): SaveCalendarEventInput[] {
  const title = validateWeeklyPlanBasics(draft);
  if (!draft.slots.length || draft.slots.length > 7) throw new InvalidInput("Choose at least one weekday.");
  validateWeeklyPlanSlots(draft.slots);

  let schedule: ReturnType<typeof buildWeeklyPlanSchedule>;
  try {
    schedule = buildWeeklyPlanSchedule(draft.startsOn, draft.timeZone, draft.slots);
  } catch {
    throw new InvalidInput("One selected weekday does not occur before this month ends.");
  }

  return schedule.slots.map((slot) => {
    return {
      actorUserId: viewer.appUserId,
      studentUserId: draft.studentUserId,
      title,
      description: draft.description?.trim() || null,
      kind: "study_session" as const,
      status: "scheduled" as const,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      timeZone: draft.timeZone,
      recurrenceFrequency: "weekly" as const,
      recurrenceInterval: 1,
      recurrenceEndsAt: schedule.planEndsAt,
      reminderMinutes: draft.reminderMinutes,
      completedAt: null,
      planGroupId,
      planStartsAt: schedule.planStartsAt,
      planEndsAt: schedule.planEndsAt,
    };
  });
}

function validateWeeklyPlanWeek(draft: WeeklyPlanDraft, planStartsOn: string, planEndsOn: string) {
  validateWeeklyPlanBasics(draft);
  if (draft.slots.length > 7) throw new InvalidInput("A week can contain at most seven study days.");
  validateWeeklyPlanSlots(draft.slots);
  try {
    return buildWeeklyPlanWeekSchedule(draft.startsOn, planStartsOn, planEndsOn, draft.timeZone, draft.slots);
  } catch {
    throw new InvalidInput("Choose weekdays that fall inside this planned week.");
  }
}

function validateWeeklyPlanBasics(draft: WeeklyPlanDraft) {
  const title = draft.title.trim();
  if (!title || title.length > 120) throw new InvalidInput("Plan titles must be between 1 and 120 characters.");
  if (draft.description && draft.description.length > 2000) throw new InvalidInput("Plan notes are too long.");
  if (!isValidTimeZone(draft.timeZone)) throw new InvalidInput("Choose a valid IANA time zone.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.startsOn) || Number.isNaN(Date.parse(`${draft.startsOn}T12:00:00Z`))) {
    throw new InvalidInput("Choose a valid plan start date.");
  }
  if (!Number.isInteger(draft.reminderMinutes) || draft.reminderMinutes < 0 || draft.reminderMinutes > 40320) {
    throw new InvalidInput("Invalid reminder time.");
  }
  return title;
}

function validateWeeklyPlanSlots(slots: WeeklyPlanSlotDraft[]) {
  const weekdays = new Set<number>();
  for (const slot of slots) {
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6 || weekdays.has(slot.weekday)) {
      throw new InvalidInput("Each weekday can appear only once.");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime)) throw new InvalidInput("Choose a valid start time.");
    if (!Number.isInteger(slot.durationMinutes) || slot.durationMinutes < 15 || slot.durationMinutes > 240) {
      throw new InvalidInput("Sessions must last between 15 minutes and four hours.");
    }
    weekdays.add(slot.weekday);
  }
}

function localDateKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function earliest(values: Date[]) {
  return new Date(Math.min(...values.map((value) => value.getTime())));
}

function latest(values: Date[]) {
  return new Date(Math.max(...values.map((value) => value.getTime())));
}

function toView(event: CalendarOccurrence<CalendarEventRecord>): CalendarOccurrenceView {
  return {
    id: event.id,
    studentUserId: event.studentUserId,
    title: event.title,
    description: event.description,
    kind: event.kind,
    status: event.status,
    startsAt: event.startsAt.getTime(),
    endsAt: event.endsAt.getTime(),
    occurrenceStart: event.occurrenceStart.getTime(),
    occurrenceEnd: event.occurrenceEnd.getTime(),
    timeZone: event.timeZone,
    recurrenceFrequency: event.recurrenceFrequency,
    recurrenceInterval: event.recurrenceInterval,
    recurrenceEndsAt: event.recurrenceEndsAt?.getTime() ?? null,
    reminderMinutes: event.reminderMinutes,
    completedAt: event.completedAt?.getTime() ?? null,
    createdByUserId: event.createdByUserId,
    updatedByUserId: event.updatedByUserId,
    planGroupId: event.planGroupId,
    planStartsAt: event.planStartsAt?.getTime() ?? null,
    planEndsAt: event.planEndsAt?.getTime() ?? null,
  };
}

async function recordCalendarAudit(viewer: Viewer, event: CalendarEventRecord, action: string) {
  await recordAuditEvent({
    actorUserId: viewer.appUserId,
    targetUserId: event.studentUserId,
    action,
    targetType: "calendar_event",
    targetId: event.id,
    metadata: { kind: event.kind, managedByParent: viewer.role === "parent" },
  });
}
