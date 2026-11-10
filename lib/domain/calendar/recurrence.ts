export type CalendarRecurrenceFrequency = "daily" | "weekly" | "monthly";

export type CalendarEventSource = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  recurrenceFrequency: CalendarRecurrenceFrequency | null;
  recurrenceInterval: number;
  recurrenceEndsAt: Date | null;
};

export type CalendarOccurrence<T extends CalendarEventSource = CalendarEventSource> = T & {
  occurrenceStart: Date;
  occurrenceEnd: Date;
};

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function monthRangeInTimeZone(month: string, timeZone: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("INVALID_MONTH");
  if (!isValidTimeZone(timeZone)) throw new Error("INVALID_TIME_ZONE");
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12
    ? { year: year + 1, month: 1 }
    : { year, month: monthNumber + 1 };
  return {
    from: zonedLocalToUtc({ year, month: monthNumber, day: 1, hour: 0, minute: 0, second: 0 }, timeZone),
    to: zonedLocalToUtc({ ...next, day: 1, hour: 0, minute: 0, second: 0 }, timeZone),
  };
}

export function localDateTimeToUtc(value: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || !isValidTimeZone(timeZone)) throw new Error("INVALID_LOCAL_DATE_TIME");
  return zonedLocalToUtc({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  }, timeZone);
}

export function expandCalendarEvents<T extends CalendarEventSource>(
  sources: T[],
  from: Date,
  to: Date,
  maximum = 500,
): CalendarOccurrence<T>[] {
  const occurrences: CalendarOccurrence<T>[] = [];
  for (const source of sources) {
    const duration = source.endsAt.getTime() - source.startsAt.getTime();
    if (duration <= 0) continue;

    if (!source.recurrenceFrequency) {
      if (source.startsAt < to && source.endsAt > from) {
        occurrences.push({ ...source, occurrenceStart: source.startsAt, occurrenceEnd: source.endsAt });
      }
      continue;
    }

    const base = zonedParts(source.startsAt, source.timeZone);
    const interval = Math.max(1, Math.min(30, Math.trunc(source.recurrenceInterval)));
    const seriesEnd = source.recurrenceEndsAt?.getTime() ?? source.startsAt.getTime();
    for (let index = 0; index < 5000; index += 1) {
      const local = addLocalInterval(base, source.recurrenceFrequency, interval * index);
      const occurrenceStart = zonedLocalToUtc(local, source.timeZone);
      if (occurrenceStart.getTime() > seriesEnd || occurrenceStart >= to) break;
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      if (occurrenceStart < to && occurrenceEnd > from) {
        occurrences.push({ ...source, occurrenceStart, occurrenceEnd });
        if (occurrences.length > maximum) throw new Error("TOO_MANY_CALENDAR_OCCURRENCES");
      }
    }
  }

  return occurrences.sort((left, right) =>
    left.occurrenceStart.getTime() - right.occurrenceStart.getTime()
      || left.title.localeCompare(right.title)
      || left.id.localeCompare(right.id));
}

function addLocalInterval(
  value: LocalDateTime,
  frequency: CalendarRecurrenceFrequency,
  amount: number,
): LocalDateTime {
  if (frequency === "monthly") {
    const monthIndex = value.year * 12 + value.month - 1 + amount;
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12 + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { ...value, year, month, day: Math.min(value.day, lastDay) };
  }

  const multiplier = frequency === "weekly" ? 7 : 1;
  const date = new Date(Date.UTC(
    value.year,
    value.month - 1,
    value.day + amount * multiplier,
    value.hour,
    value.minute,
    value.second,
  ));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: value.hour,
    minute: value.minute,
    second: value.second,
  };
}

function zonedParts(value: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: number("year"),
    month: number("month"),
    day: number("day"),
    hour: number("hour"),
    minute: number("minute"),
    second: number("second"),
  };
}

function zonedLocalToUtc(value: LocalDateTime, timeZone: string): Date {
  const target = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const correction = target - actualAsUtc;
    if (correction === 0) break;
    guess += correction;
  }
  return new Date(guess);
}
