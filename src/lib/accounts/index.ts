import type { AccountStatus, AccountType, SubmissionKind, SubmissionStatus, UserRole } from "@/lib/types";

export const ACCOUNT_TYPES: AccountType[] = [
  "delegate",
  "oral_presenter",
  "poster_presenter",
  "supporting_committee",
  "executive_committee",
  "vice_president",
  "president",
];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  delegate: "Delegate",
  oral_presenter: "Oral presenter",
  poster_presenter: "Poster presenter",
  supporting_committee: "Supporting committee",
  executive_committee: "Executive committee",
  vice_president: "Vice president",
  president: "President",
};

export const ACCOUNT_TYPE_BLURB: Record<AccountType, string> = {
  delegate: "Attending the conference, talks and workshops.",
  oral_presenter: "Giving a talk. You'll upload your slides here.",
  poster_presenter: "Presenting a poster. You'll upload it for feedback.",
  supporting_committee: "Helping run INSPIRE on the supporting committee.",
  executive_committee: "A member of the executive committee.",
  vice_president: "INSPIRE vice president.",
  president: "INSPIRE president.",
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  pending: { label: "Awaiting review", tone: "neutral" },
  approved: { label: "Approved", tone: "success" },
  waitlisted: { label: "Waitlisted", tone: "warning" },
  declined: { label: "Not approved", tone: "danger" },
};

export const COMMITTEE_TYPES: AccountType[] = ["supporting_committee", "executive_committee", "vice_president", "president"];
export const EXEC_TYPES: AccountType[] = ["executive_committee", "vice_president", "president"];
export const LEADERSHIP_TYPES: AccountType[] = ["vice_president", "president"];

export interface Access {
  /** Approved committee member (any level) or site editor. Edits content, reviews submissions. */
  committee: boolean;
  /** Approved executive member, VP, president or site admin. Reviews accounts, sees personal data. */
  exec: boolean;
  /** President, vice president or site admin. Can approve executive accounts and change site roles. */
  leadership: boolean;
}

/** Mirrors public.is_committee(), is_exec() and is_leadership() in the database. */
export function accessFor(p: { role: UserRole; accountType: AccountType; accountStatus: AccountStatus }): Access {
  const approved = p.accountStatus === "approved";
  const leadership = p.role === "admin" || (approved && LEADERSHIP_TYPES.includes(p.accountType));
  const exec = p.role === "admin" || (approved && EXEC_TYPES.includes(p.accountType));
  const committee = p.role === "admin" || p.role === "editor" || (approved && COMMITTEE_TYPES.includes(p.accountType));
  return { committee, exec, leadership };
}

/** The permission tier the existing role gates understand. */
export function effectiveRole(p: { role: UserRole; accountType: AccountType; accountStatus: AccountStatus }): UserRole {
  const a = accessFor(p);
  if (a.exec) return "admin";
  if (a.committee) return "editor";
  return p.role === "reviewer" ? "reviewer" : "delegate";
}

/** Which kind of file an account type submits, if any. */
export function submissionKindFor(t: AccountType): SubmissionKind | null {
  return t === "oral_presenter" ? "slides" : t === "poster_presenter" ? "poster" : null;
}

/** Whether a reviewer may approve this account (executive accounts need the president or VP). */
export function canApprove(reviewer: Access, target: AccountType) {
  return EXEC_TYPES.includes(target) ? reviewer.leadership : reviewer.exec;
}

export const SUBMISSION_LABEL: Record<SubmissionKind, { noun: string; title: string }> = {
  slides: { noun: "slides", title: "Presentation slides" },
  poster: { noun: "poster", title: "Poster" },
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, { label: string; tone: "success" | "warning" | "neutral" }> = {
  submitted: { label: "With the committee", tone: "neutral" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
};

export const SUBMISSION_FILES: Record<SubmissionKind, { types: Record<string, string>; accept: string; label: string; maxMb: number }> = {
  slides: {
    types: {
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.apple.keynote": "key",
      "application/x-iwork-keynote-sffkey": "key",
    },
    accept: ".pdf,.pptx,.ppt,.key,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint",
    label: "PowerPoint, Keynote or PDF",
    maxMb: 50,
  },
  poster: {
    types: { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" },
    accept: ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
    label: "PDF, PNG or JPEG",
    maxMb: 50,
  },
};

/** Browsers often send Keynote and some PowerPoint files without a type, so fall back to the extension. */
export function resolveFileType(kind: SubmissionKind, name: string, type: string): { mime: string; ext: string } | null {
  const rules = SUBMISSION_FILES[kind].types;
  if (type && rules[type]) return { mime: type, ext: rules[type] };
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const byExt = Object.entries(rules).find(([, e]) => e === ext || (ext === "jpeg" && e === "jpg"));
  return byExt ? { mime: byExt[0], ext: byExt[1] } : null;
}

export const CAREER_STAGES = [
  "Medical student, year 1",
  "Medical student, year 2",
  "Medical student, year 3",
  "Medical student, year 4",
  "Medical student, year 5",
  "Medical student, year 6",
  "Intercalating student",
  "Other healthcare student",
  "Foundation doctor",
  "Doctor in training",
  "Consultant or GP",
  "Researcher or academic",
  "Other",
];

export const HEARD_ABOUT = ["Friend or classmate", "Medical school", "Instagram", "LinkedIn", "Email", "Previous INSPIRE", "Other"];

/** Bump when the privacy notice changes in a way people should be told about. */
export const POLICY_VERSION = "2026-11-11";
