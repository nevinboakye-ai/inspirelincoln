const UK = "Europe/London";

/** "just now", "5 minutes ago", "yesterday at 14:05", "Mon 3 Nov", in UK time. */
export function timeAgo(iso: string, now = Date.now()) {
  const t = Date.parse(iso);
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(m / 60);
  const day = (d: number) => new Date(d).toLocaleDateString("en-GB", { timeZone: UK });
  const clock = new Date(t).toLocaleTimeString("en-GB", { timeZone: UK, hour: "2-digit", minute: "2-digit" });
  if (day(t) === day(now)) return h < 6 ? `${h} ${h === 1 ? "hour" : "hours"} ago` : `today at ${clock}`;
  if (day(t) === day(now - 86400000)) return `yesterday at ${clock}`;
  const days = Math.floor(s / 86400);
  if (days < 7) return `${new Date(t).toLocaleDateString("en-GB", { timeZone: UK, weekday: "long" })} at ${clock}`;
  return new Date(t).toLocaleDateString("en-GB", { timeZone: UK, day: "numeric", month: "short", year: days > 300 ? "numeric" : undefined });
}

export function fullTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: UK, dateStyle: "full", timeStyle: "short" });
}
