import { localDateTimeToUtc } from "./recurrence.ts";

export type WeeklyPlanTimeSlot = {
  weekday: number;
  startTime: string;
  durationMinutes: number;
};

export function buildWeeklyPlanSchedule(
  startsOn: string,
  timeZone: string,
  slots: WeeklyPlanTimeSlot[],
) {
  const [year, month] = startsOn.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endsOn = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const planStartsAt = localDateTimeToUtc(`${startsOn}T00:00:00`, timeZone);
  const planEndsAt = localDateTimeToUtc(`${endsOn}T23:59:59`, timeZone);
  const startWeekday = new Date(`${startsOn}T12:00:00Z`).getUTCDay();

  return {
    endsOn,
    planStartsAt,
    planEndsAt,
    slots: slots.map((slot) => {
      const firstDate = addDateDays(startsOn, (slot.weekday - startWeekday + 7) % 7);
      if (firstDate > endsOn) throw new Error("WEEKDAY_OUTSIDE_PLAN_MONTH");
      const startsAt = localDateTimeToUtc(`${firstDate}T${slot.startTime}:00`, timeZone);
      return {
        ...slot,
        firstDate,
        startsAt,
        endsAt: new Date(startsAt.getTime() + slot.durationMinutes * 60_000),
      };
    }),
  };
}

export function buildWeeklyPlanWeekSchedule(
  weekStartsOn: string,
  planStartsOn: string,
  planEndsOn: string,
  timeZone: string,
  slots: WeeklyPlanTimeSlot[],
) {
  if (new Date(`${weekStartsOn}T12:00:00Z`).getUTCDay() !== 1) throw new Error("WEEK_MUST_START_ON_MONDAY");
  const weekEndsOn = addDateDays(weekStartsOn, 6);
  const effectiveStartsOn = weekStartsOn > planStartsOn ? weekStartsOn : planStartsOn;
  const effectiveEndsOn = weekEndsOn < planEndsOn ? weekEndsOn : planEndsOn;
  if (effectiveStartsOn > effectiveEndsOn) throw new Error("WEEK_OUTSIDE_PLAN");

  return {
    weekEndsOn,
    effectiveStartsOn,
    effectiveEndsOn,
    slots: slots.map((slot) => {
      const date = addDateDays(weekStartsOn, (slot.weekday + 6) % 7);
      if (date < effectiveStartsOn || date > effectiveEndsOn) throw new Error("WEEKDAY_OUTSIDE_PLAN");
      const startsAt = localDateTimeToUtc(`${date}T${slot.startTime}:00`, timeZone);
      return {
        ...slot,
        date,
        startsAt,
        endsAt: new Date(startsAt.getTime() + slot.durationMinutes * 60_000),
      };
    }),
  };
}

export function addDateDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
