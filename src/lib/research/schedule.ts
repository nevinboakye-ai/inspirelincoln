import type { Stage } from "@/lib/research/instrument";

/** The study's settings, as stored in public.research_study. */
export type StudySettings = {
  enabled: boolean;
  ethicsCommittee: string | null;
  ethicsReference: string | null;
  ethicsApprovedOn: string | null;
  governanceConfirmed: boolean;
  leadName: string | null;
  leadEmail: string | null;
  protocolVersion: string;
  infoVersion: string;
  /** The conference date (YYYY-MM-DD), used to count days in the export instead of exact dates. */
  eventDate: string;
  preClosesAt: string | null;
  postOpensAt: string | null;
  postClosesAt: string | null;
  followupOpensAt: string | null;
  followupClosesAt: string | null;
  anonymisedAt: string | null;
};

export const DEFAULT_SETTINGS: StudySettings = {
  enabled: false,
  ethicsCommittee: null,
  ethicsReference: null,
  ethicsApprovedOn: null,
  governanceConfirmed: false,
  leadName: null,
  leadEmail: null,
  protocolVersion: "1.0",
  infoVersion: "1.0",
  eventDate: "2026-11-21",
  // 09:00 on the day, when the welcome starts (UK time is GMT in November).
  preClosesAt: "2026-11-21T09:00:00Z",
  // Closing and prizes start at 15:25.
  postOpensAt: "2026-11-21T15:15:00Z",
  postClosesAt: "2026-12-05T23:59:00Z",
  // Eight weeks after is Saturday 16 January 2027. The window runs from 7 to 10 weeks.
  followupOpensAt: "2027-01-09T09:00:00Z",
  followupClosesAt: "2027-01-30T23:59:00Z",
  anonymisedAt: null,
};

/** Maps a database row to settings. */
export function settingsFromRow(r: Record<string, unknown> | null | undefined): StudySettings {
  if (!r) return DEFAULT_SETTINGS;
  const s = (k: string) => (typeof r[k] === "string" && (r[k] as string).trim() ? (r[k] as string) : null);
  return {
    enabled: r.enabled === true,
    ethicsCommittee: s("ethics_committee"),
    ethicsReference: s("ethics_reference"),
    ethicsApprovedOn: s("ethics_approved_on"),
    governanceConfirmed: r.governance_confirmed === true,
    leadName: s("lead_name"),
    leadEmail: s("lead_email"),
    protocolVersion: s("protocol_version") ?? "1.0",
    infoVersion: s("info_version") ?? "1.0",
    eventDate: s("event_date") ?? DEFAULT_SETTINGS.eventDate,
    preClosesAt: s("pre_closes_at"),
    postOpensAt: s("post_opens_at"),
    postClosesAt: s("post_closes_at"),
    followupOpensAt: s("followup_opens_at"),
    followupClosesAt: s("followup_closes_at"),
    anonymisedAt: s("anonymised_at"),
  };
}

/** What still stops the study being switched on. Empty when it can be. */
export function launchBlockers(s: StudySettings): string[] {
  const out: string[] = [];
  if (!s.ethicsCommittee) out.push("Name the ethics committee that approved the study");
  if (!s.ethicsReference) out.push("Add the ethics approval reference");
  if (!s.ethicsApprovedOn) out.push("Add the date of ethics approval");
  if (!s.governanceConfirmed) out.push("Confirm the data governance arrangements are in place");
  if (!s.leadName || !s.leadEmail) out.push("Add the lead researcher's name and email for participants");
  if (!s.preClosesAt || !s.postOpensAt || !s.postClosesAt || !s.followupOpensAt || !s.followupClosesAt) out.push("Set every questionnaire window");
  else {
    const t = (x: string) => new Date(x).getTime();
    if (!(t(s.preClosesAt) <= t(s.postOpensAt) && t(s.postOpensAt) < t(s.postClosesAt) && t(s.postClosesAt) <= t(s.followupOpensAt) && t(s.followupOpensAt) < t(s.followupClosesAt)))
      out.push("Put the questionnaire windows in order: before, after, then eight weeks on");
  }
  if (s.anonymisedAt) out.push("The data have been anonymised, so this study has ended");
  return out;
}

/** When each questionnaire opens and closes. The first is open from launch until the conference starts. */
export function windowOf(s: StudySettings, stage: Stage): { opens: string | null; closes: string | null } {
  if (stage === "pre") return { opens: null, closes: s.preClosesAt };
  if (stage === "post") return { opens: s.postOpensAt, closes: s.postClosesAt };
  return { opens: s.followupOpensAt, closes: s.followupClosesAt };
}

export function isOpen(s: StudySettings, stage: Stage, now = new Date()): boolean {
  if (!s.enabled || s.anonymisedAt) return false;
  const w = windowOf(s, stage);
  const t = now.getTime();
  if (!w.closes) return false;
  return (!w.opens || new Date(w.opens).getTime() <= t) && t <= new Date(w.closes).getTime();
}

/** New people can join only while the first questionnaire is open, so everyone has a baseline. */
export const canEnrol = (s: StudySettings, now = new Date()) => isOpen(s, "pre", now);

/** The questionnaire a participant should do now, if any. */
export function dueStage(s: StudySettings, done: readonly Stage[], now = new Date()): Stage | null {
  for (const st of ["pre", "post", "followup"] as const) if (!done.includes(st) && isOpen(s, st, now)) return st;
  return null;
}

/** The next questionnaire still to come, for "opens on ..." messages. */
export function nextStage(s: StudySettings, done: readonly Stage[], now = new Date()): { stage: Stage; opens: string } | null {
  for (const st of ["post", "followup"] as const) {
    const w = windowOf(s, st);
    if (!done.includes(st) && w.opens && new Date(w.opens).getTime() > now.getTime()) return { stage: st, opens: w.opens };
  }
  return null;
}

export function formatWhen(iso: string | null, withTime = true) {
  if (!iso) return "not set";
  return new Date(iso)
    .toLocaleString("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}) })
    .replace(":00", "");
}
