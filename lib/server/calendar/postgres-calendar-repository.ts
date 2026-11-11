import { and, eq, gt, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { getDb } from "../../../db/index.ts";
import {
  calendarEventExports,
  calendarEvents,
  googleCalendarConnections,
} from "../../../db/schema.ts";
import type {
  CalendarExportRecord,
  CalendarRepository,
  GoogleCalendarConnectionRecord,
  SaveCalendarEventInput,
} from "./calendar-repository";

type Database = ReturnType<typeof getDb>;

export class PostgresCalendarRepository implements CalendarRepository {
  constructor(private readonly db: Database) {}

  async listEventSources(studentUserId: string, from: Date, to: Date) {
    return this.db
      .select()
      .from(calendarEvents)
      .where(and(
        eq(calendarEvents.studentUserId, studentUserId),
        lt(calendarEvents.startsAt, to),
        or(
          and(isNull(calendarEvents.recurrenceFrequency), gt(calendarEvents.endsAt, from)),
          and(
            isNotNull(calendarEvents.recurrenceFrequency),
            isNotNull(calendarEvents.recurrenceEndsAt),
            gte(calendarEvents.recurrenceEndsAt, from),
          ),
        ),
      ));
  }

  async getEvent(eventId: string) {
    const rows = await this.db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1);
    return rows[0] ?? null;
  }

  async createEvent(input: SaveCalendarEventInput) {
    const now = new Date();
    const rows = await this.db.insert(calendarEvents).values({
      ...eventValues(input),
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    }).returning();
    if (!rows[0]) throw new Error("CALENDAR_EVENT_CREATE_FAILED");
    return rows[0];
  }

  async updateEvent(eventId: string, input: SaveCalendarEventInput) {
    const rows = await this.db.update(calendarEvents).set({
      ...eventValues(input),
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    }).where(eq(calendarEvents.id, eventId)).returning();
    return rows[0] ?? null;
  }

  async listPlanEvents(planGroupId: string) {
    return this.db.select().from(calendarEvents).where(eq(calendarEvents.planGroupId, planGroupId));
  }

  async createEvents(inputs: SaveCalendarEventInput[]) {
    if (!inputs.length) return [];
    const now = new Date();
    return this.db.insert(calendarEvents).values(inputs.map((input) => ({
      ...eventValues(input),
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      createdAt: now,
      updatedAt: now,
    }))).returning();
  }

  async deleteEvents(eventIds: string[]) {
    if (!eventIds.length) return;
    await this.db.delete(calendarEvents).where(inArray(calendarEvents.id, eventIds));
  }

  async getGoogleConnection(userId: string) {
    const rows = await this.db.select({
      userId: googleCalendarConnections.userId,
      encryptedRefreshToken: googleCalendarConnections.encryptedRefreshToken,
      grantedScopes: googleCalendarConnections.grantedScopes,
    }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId)).limit(1);
    return rows[0] ?? null;
  }

  async saveGoogleConnection(connection: GoogleCalendarConnectionRecord) {
    const now = new Date();
    await this.db.insert(googleCalendarConnections).values({
      ...connection,
      connectedAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: googleCalendarConnections.userId,
      set: {
        encryptedRefreshToken: connection.encryptedRefreshToken,
        grantedScopes: connection.grantedScopes,
        connectedAt: now,
        updatedAt: now,
      },
    });
  }

  async deleteGoogleConnection(userId: string) {
    await this.db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
  }

  async getExport(calendarEventId: string, userId: string, occurrenceStart: Date) {
    const rows = await this.db.select().from(calendarEventExports).where(and(
      eq(calendarEventExports.calendarEventId, calendarEventId),
      eq(calendarEventExports.userId, userId),
      eq(calendarEventExports.occurrenceStart, occurrenceStart),
    )).limit(1);
    return rows[0] ?? null;
  }

  async saveExport(input: Omit<CalendarExportRecord, "id">) {
    const now = new Date();
    const rows = await this.db.insert(calendarEventExports).values({
      ...input,
      exportedAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [
        calendarEventExports.calendarEventId,
        calendarEventExports.userId,
        calendarEventExports.occurrenceStart,
      ],
      set: {
        googleCalendarId: input.googleCalendarId,
        googleEventId: input.googleEventId,
        exportedAt: now,
        updatedAt: now,
      },
    }).returning();
    if (!rows[0]) throw new Error("CALENDAR_EXPORT_SAVE_FAILED");
    return rows[0];
  }
}

function eventValues(input: SaveCalendarEventInput) {
  return {
    studentUserId: input.studentUserId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    status: input.status,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timeZone: input.timeZone,
    recurrenceFrequency: input.recurrenceFrequency,
    recurrenceInterval: input.recurrenceInterval,
    recurrenceEndsAt: input.recurrenceEndsAt,
    reminderMinutes: input.reminderMinutes,
    completedAt: input.completedAt,
    planGroupId: input.planGroupId,
    planStartsAt: input.planStartsAt,
    planEndsAt: input.planEndsAt,
  };
}
