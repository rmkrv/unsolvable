import type { CalendarRecurrenceFrequency } from "@/lib/domain/calendar/recurrence";

export type CalendarEventKind = "study_session" | "deadline";
export type CalendarEventStatus = "scheduled" | "completed" | "cancelled";

export type CalendarEventRecord = {
  id: string;
  studentUserId: string;
  createdByUserId: string;
  updatedByUserId: string;
  title: string;
  description: string | null;
  kind: CalendarEventKind;
  status: CalendarEventStatus;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  recurrenceFrequency: CalendarRecurrenceFrequency | null;
  recurrenceInterval: number;
  recurrenceEndsAt: Date | null;
  reminderMinutes: number;
  completedAt: Date | null;
  planGroupId: string | null;
  planStartsAt: Date | null;
  planEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SaveCalendarEventInput = Pick<
  CalendarEventRecord,
  | "studentUserId"
  | "title"
  | "description"
  | "kind"
  | "status"
  | "startsAt"
  | "endsAt"
  | "timeZone"
  | "recurrenceFrequency"
  | "recurrenceInterval"
  | "recurrenceEndsAt"
  | "reminderMinutes"
  | "completedAt"
  | "planGroupId"
  | "planStartsAt"
  | "planEndsAt"
> & { actorUserId: string };

export type GoogleCalendarConnectionRecord = {
  userId: string;
  encryptedRefreshToken: string;
  grantedScopes: string;
};

export type CalendarExportRecord = {
  id: string;
  calendarEventId: string;
  userId: string;
  occurrenceStart: Date;
  googleCalendarId: string;
  googleEventId: string;
};

export interface CalendarRepository {
  listEventSources(studentUserId: string, from: Date, to: Date): Promise<CalendarEventRecord[]>;
  getEvent(eventId: string): Promise<CalendarEventRecord | null>;
  createEvent(input: SaveCalendarEventInput): Promise<CalendarEventRecord>;
  updateEvent(eventId: string, input: SaveCalendarEventInput): Promise<CalendarEventRecord | null>;
  listPlanEvents(planGroupId: string): Promise<CalendarEventRecord[]>;
  createEvents(inputs: SaveCalendarEventInput[]): Promise<CalendarEventRecord[]>;
  deleteEvents(eventIds: string[]): Promise<void>;
  getGoogleConnection(userId: string): Promise<GoogleCalendarConnectionRecord | null>;
  saveGoogleConnection(connection: GoogleCalendarConnectionRecord): Promise<void>;
  getExport(calendarEventId: string, userId: string, occurrenceStart: Date): Promise<CalendarExportRecord | null>;
  saveExport(input: Omit<CalendarExportRecord, "id">): Promise<CalendarExportRecord>;
}
