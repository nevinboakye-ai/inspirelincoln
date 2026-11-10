import type { Edition, Session } from "./types";

export const UK_TZ = "Europe/London";

/** Offset in minutes between `timeZone` and UTC at the given instant. */
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Converts a wall-clock date and time in `timeZone` to a UTC Date. */
export function zonedTimeToUtc(date: string, time: string, timeZone = UK_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = tzOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Re-check once in case the guess straddled a DST boundary.
  const offset2 = tzOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/**
 * The countdown target. Uses the configured start time when set; otherwise the
 * start of the conference day in UK time, which is labelled as such in the UI.
 */
export function eventStart(edition: Pick<Edition, "date" | "startTime" | "timezone">) {
  return {
    at: zonedTimeToUtc(edition.date, edition.startTime ?? "00:00", edition.timezone),
    hasConfirmedTime: Boolean(edition.startTime),
  };
}

/** End of the event: configured end time, or the end of the day in UK time. */
export function eventEnd(edition: Pick<Edition, "date" | "endTime" | "timezone">) {
  return edition.endTime
    ? zonedTimeToUtc(edition.date, edition.endTime, edition.timezone)
    : zonedTimeToUtc(edition.date, "23:59", edition.timezone);
}

export function formatEventDate(date: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: UK_TZ,
    ...opts,
  }).format(zonedTimeToUtc(date, "12:00"));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: UK_TZ,
  }).format(new Date(iso));
}

export function durationMinutes(s: Pick<Session, "startsAt" | "endsAt">) {
  if (!s.startsAt || !s.endsAt) return null;
  return Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000);
}

export function formatDuration(mins: number | null) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Whether two timed sessions overlap. Untimed sessions never conflict. */
export function overlaps(a: Pick<Session, "startsAt" | "endsAt">, b: Pick<Session, "startsAt" | "endsAt">) {
  if (!a.startsAt || !a.endsAt || !b.startsAt || !b.endsAt) return false;
  return new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt);
}

/** Returns the set of session ids that clash with another session in the list. */
export function findConflicts(sessions: Pick<Session, "id" | "startsAt" | "endsAt">[]) {
  const ids = new Set<string>();
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      if (overlaps(sessions[i], sessions[j])) {
        ids.add(sessions[i].id);
        ids.add(sessions[j].id);
      }
    }
  }
  return ids;
}

export function daysUntil(dateIso: string, now = new Date()) {
  const target = zonedTimeToUtc(dateIso, "23:59");
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

/** Formats an ISO instant as a `datetime-local` input value in UK time. */
export function toZonedInputValue(iso: string | null | undefined, timeZone = UK_TZ) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Parses a `datetime-local` value entered in UK time to an ISO instant. */
export function fromZonedInputValue(v: string, timeZone = UK_TZ) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(v.trim());
  return m ? zonedTimeToUtc(m[1], m[2], timeZone).toISOString() : null;
}
