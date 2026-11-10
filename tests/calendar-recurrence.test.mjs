import test from "node:test";
import assert from "node:assert/strict";
import {
  expandCalendarEvents,
  localDateTimeToUtc,
  monthRangeInTimeZone,
} from "../lib/domain/calendar/recurrence.ts";

test("weekly sessions keep their local wall time across daylight-saving changes", () => {
  const timeZone = "Europe/Warsaw";
  const startsAt = localDateTimeToUtc("2026-03-22T18:00", timeZone);
  const events = expandCalendarEvents([{
    id: "weekly-session",
    title: "Calculus review",
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60_000),
    timeZone,
    recurrenceFrequency: "weekly",
    recurrenceInterval: 1,
    recurrenceEndsAt: localDateTimeToUtc("2026-04-05T18:00", timeZone),
  }], new Date("2026-03-01T00:00:00Z"), new Date("2026-04-10T00:00:00Z"));

  assert.deepEqual(events.map((event) => event.occurrenceStart.toISOString()), [
    "2026-03-22T17:00:00.000Z",
    "2026-03-29T16:00:00.000Z",
    "2026-04-05T16:00:00.000Z",
  ]);
});

test("month ranges follow the selected IANA time zone", () => {
  const range = monthRangeInTimeZone("2026-11", "Europe/Warsaw");
  assert.equal(range.from.toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-11-30T23:00:00.000Z");
});

test("monthly recurrence clamps to the last valid day", () => {
  const startsAt = new Date("2026-01-31T10:00:00Z");
  const events = expandCalendarEvents([{
    id: "month-end",
    title: "Month-end review",
    startsAt,
    endsAt: new Date("2026-01-31T11:00:00Z"),
    timeZone: "UTC",
    recurrenceFrequency: "monthly",
    recurrenceInterval: 1,
    recurrenceEndsAt: new Date("2026-03-31T10:00:00Z"),
  }], new Date("2026-01-01T00:00:00Z"), new Date("2026-04-01T00:00:00Z"));

  assert.deepEqual(events.map((event) => event.occurrenceStart.toISOString()), [
    "2026-01-31T10:00:00.000Z",
    "2026-02-28T10:00:00.000Z",
    "2026-03-31T10:00:00.000Z",
  ]);
});
