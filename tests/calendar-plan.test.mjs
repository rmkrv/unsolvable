import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyPlanSchedule, buildWeeklyPlanWeekSchedule } from "../lib/domain/calendar/weekly-plan.ts";

test("one weekly plan creates weekday-specific recurring series through month end", async () => {
  const schedule = buildWeeklyPlanSchedule("2026-11-10", "Europe/Warsaw", [
    { weekday: 5, startTime: "16:00", durationMinutes: 60 },
    { weekday: 6, startTime: "17:00", durationMinutes: 60 },
    { weekday: 0, startTime: "15:00", durationMinutes: 60 },
  ]);

  assert.deepEqual(schedule.slots.map((slot) => slot.startsAt.toISOString()), [
    "2026-11-13T15:00:00.000Z",
    "2026-11-14T16:00:00.000Z",
    "2026-11-15T14:00:00.000Z",
  ]);
  assert.equal(schedule.planEndsAt.toISOString(), "2026-11-30T22:59:59.000Z");
});

test("a weekly override changes only dates inside its Monday-to-Sunday window", () => {
  const schedule = buildWeeklyPlanWeekSchedule(
    "2026-11-16",
    "2026-11-10",
    "2026-11-30",
    "Europe/Warsaw",
    [
      { weekday: 2, startTime: "18:00", durationMinutes: 45 },
      { weekday: 6, startTime: "10:30", durationMinutes: 90 },
    ],
  );

  assert.equal(schedule.effectiveStartsOn, "2026-11-16");
  assert.equal(schedule.effectiveEndsOn, "2026-11-22");
  assert.deepEqual(schedule.slots.map((slot) => slot.startsAt.toISOString()), [
    "2026-11-17T17:00:00.000Z",
    "2026-11-21T09:30:00.000Z",
  ]);
});
