import type { AccountStatus, AccountType, SubmissionKind, SubmissionStatus, UserRole } from "@/lib/types";

export const ACCOUNT_TYPES: AccountType[] = [
  "delegate",
  "oral_presenter",
  "poster_presenter",
  "oral_waitlist",
  "supporting_committee",
  "academic_team",
  "publicity_team",
  "finance_team",
  "logistics_team",
  "executive_committee",
  "vice_president",
  "president",
];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  delegate: "Delegate",
  oral_presenter: "Oral presenter",
  poster_presenter: "Poster presenter",
  oral_waitlist: "Oral waiting list",
  supporting_committee: "Supporting committee",
  academic_team: "Academic Team",
  publicity_team: "Publicity Team",
  finance_team: "Finance Team",
  logistics_team: "Logistics Team",
  executive_committee: "Executive committee",
  vice_president: "Vice president",
  president: "President",
};

export const ACCOUNT_TYPE_BLURB: Record<AccountType, string> = {
  delegate: "Attending the conference, talks and workshops.",
  oral_presenter: "Giving a talk. You'll upload your slides here.",
  poster_presenter: "Presenting a poster. You'll upload it for feedback.",
  oral_waitlist: "Presenting a poster, and on the waiting list for an oral presentation.",
  supporting_committee: "Helping run INSPIRE on the supporting committee.",
  academic_team: "Supporting committee: the Academic Team.",
  publicity_team: "Supporting committee: the Publicity Team.",
  finance_team: "Supporting committee: the Finance Team.",
  logistics_team: "Supporting committee: the Logistics Team.",
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

/** Types that can go on the selected delegate list: everyone attending who isn't committee. */
export const ROSTER_TYPES = ["delegate", "poster_presenter", "oral_presenter", "oral_waitlist"] as const satisfies readonly AccountType[];
export type RosterType = (typeof ROSTER_TYPES)[number];

/** The supporting committee and its teams. */
export const SUPPORTING_TYPES: AccountType[] = ["supporting_committee", "academic_team", "publicity_team", "finance_team", "logistics_team"];
export const COMMITTEE_TYPES: AccountType[] = [...SUPPORTING_TYPES, "executive_committee", "vice_president", "president"];
export const EXEC_TYPES: AccountType[] = ["executive_committee", "vice_president", "president"];

/** Account types grouped the way the committee thinks about them, for pickers. */
export const ACCOUNT_TYPE_GROUPS: { title: string; hint: string; types: AccountType[] }[] = [
  { title: "Attending", hint: "Delegates and presenters", types: ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"] },
  { title: "Supporting committee", hint: "Can edit the website and review slides and posters", types: SUPPORTING_TYPES },
  { title: "Executive committee", hint: "Can also review accounts and email groups", types: EXEC_TYPES },
];
export const LEADERSHIP_TYPES: AccountType[] = ["vice_president", "president"];

/**
 * Every role, most senior first. Someone can hold several (the vice president
 * who also leads the Academic Team, or a committee member presenting a
 * poster); the most senior is their main role and the rest are extra roles.
 */
export const ROLE_RANK: AccountType[] = [
  "president",
  "vice_president",
  "executive_committee",
  "academic_team",
  "publicity_team",
  "finance_team",
  "logistics_team",
  "supporting_committee",
  "oral_presenter",
  "poster_presenter",
  "oral_waitlist",
  "delegate",
];
const ATTENDING: AccountType[] = ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"];

/** Every role someone holds, main role first, without repeats. */
export function rolesOf(main: AccountType, extra?: readonly AccountType[] | null): AccountType[] {
  return [main, ...(extra ?? []).filter((t, i, a) => t !== main && a.indexOf(t) === i)];
}

/** Whether someone holds a role, as their main role or an extra one. */
export function hasRole(p: { accountType: AccountType; extraTypes?: readonly AccountType[] | null }, ...types: AccountType[]) {
  return rolesOf(p.accountType, p.extraTypes).some((t) => types.includes(t));
}

/** "Vice president · Academic Team" */
export function rolesLabel(types: readonly AccountType[]) {
  return types.map((t) => ACCOUNT_TYPE_LABEL[t]).join(" · ");
}

/**
 * Tidy a set of ticked roles into a main role and extra roles, or say what's
 * wrong. Delegate is dropped when someone is already presenting or waiting,
 * since those include attending. Everyone on the oral waiting list also
 * presents a poster (the database adds it too).
 */
export function splitRoles(picked: readonly string[]): { main: AccountType; extra: AccountType[] } | { error: string } {
  let types = ROLE_RANK.filter((t) => picked.includes(t) || (t === "poster_presenter" && picked.includes("oral_waitlist")));
  if (!types.length) return { error: "Choose at least one role." };
  if (types.includes("president") && types.includes("vice_president")) return { error: "Someone can't be both president and vice president." };
  if (types.includes("oral_presenter") && types.includes("oral_waitlist")) return { error: "Someone can't be an oral presenter and on the oral waiting list." };
  if (types.includes("delegate") && types.some((t) => t !== "delegate" && ATTENDING.includes(t))) types = types.filter((t) => t !== "delegate");
  return { main: types[0], extra: types.slice(1) };
}

/** The presentation someone uploads, from any of their roles (slides first if they somehow have both). */
export function presenterKindOf(p: { accountType: AccountType; extraTypes?: readonly AccountType[] | null }): SubmissionKind | null {
  return submissionKindsFor(rolesOf(p.accountType, p.extraTypes))[0] ?? null;
}

/** Which presentations someone's roles let them upload. */
export function submissionKindsFor(types: readonly AccountType[]): SubmissionKind[] {
  return [...(types.includes("oral_presenter") ? (["slides"] as const) : []), ...(types.includes("poster_presenter") ? (["poster"] as const) : [])];
}

/** Things a person can be allowed to do. Mirrors public.access_capabilities. */
export const CAPABILITIES = [
  "edit_website",
  "review_submissions",
  "review_accounts",
  "approve_committee",
  "manage_people",
  "check_in",
  "send_email",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABEL: Record<Capability, { label: string; description: string }> = {
  edit_website: { label: "Edit the website", description: "Programme, speakers, committee, campus map, FAQs, announcements and conference settings." },
  review_submissions: { label: "Review slides and posters", description: "See presenters' uploads and give feedback, request changes or approve them." },
  review_accounts: { label: "Review accounts", description: "See new registrations and approve, waitlist or decline them." },
  approve_committee: { label: "Approve committee accounts", description: "Approve executive committee, vice president and president accounts." },
  manage_people: { label: "Delegate records", description: "Registrations, abstracts, poster records, enquiries and the audit log. This is personal data." },
  check_in: { label: "Check-in desk", description: "Scan tickets and check people in on the day." },
  send_email: { label: "Group emails", description: "Send emails to groups of delegates, presenters or the committee." },
};

/** The defaults the database starts with, used only if the access tables aren't set up yet. */
export const DEFAULT_RULES: Record<AccountType, Capability[]> = {
  delegate: [],
  oral_presenter: [],
  poster_presenter: [],
  oral_waitlist: [],
  supporting_committee: ["edit_website", "review_submissions"],
  academic_team: ["edit_website", "review_submissions"],
  publicity_team: ["edit_website", "review_submissions"],
  finance_team: ["edit_website", "review_submissions"],
  logistics_team: ["edit_website", "review_submissions"],
  executive_committee: ["edit_website", "review_submissions", "review_accounts", "manage_people", "check_in"],
  vice_president: [...CAPABILITIES],
  president: [...CAPABILITIES],
};

export interface Access {
  /** Each permission, as the database decides it (public.has_access). */
  can: Record<Capability, boolean>;
  /** Has at least one permission, so can open the committee dashboard. */
  committee: boolean;
  /** Can review accounts. */
  exec: boolean;
  /** Can approve committee and leadership accounts. */
  leadership: boolean;
  /** Site owner (site role admin). Above everyone: controls who can do what. */
  owner: boolean;
}

type AccessInput = { role: UserRole; accountType: AccountType; accountStatus: AccountStatus };

/** Builds access from the list of permissions the database returned (public.my_access()). */
export function accessFromCaps(caps: readonly string[], role: UserRole): Access {
  const owner = role === "admin";
  const can = Object.fromEntries(CAPABILITIES.map((c) => [c, owner || caps.includes(c)])) as Record<Capability, boolean>;
  return { can, committee: CAPABILITIES.some((c) => can[c]), exec: can.review_accounts, leadership: can.approve_committee, owner };
}

/** Default access for an account, before any changes on the platform dashboard. */
export function accessFor(p: AccessInput): Access {
  const fromType = p.accountStatus === "approved" ? DEFAULT_RULES[p.accountType] : [];
  const legacy: Capability[] = p.role === "editor" ? ["edit_website", "review_submissions"] : [];
  return accessFromCaps([...fromType, ...legacy], p.role);
}

/** The permission tier the older role gates understand. */
export function effectiveRole(access: Access, role: UserRole): UserRole {
  if (access.owner || access.can.manage_people) return "admin";
  if (access.can.edit_website) return "editor";
  return role === "reviewer" ? "reviewer" : "delegate";
}

/** Which kind of file an account type submits, if any. */
export function submissionKindFor(t: AccountType): SubmissionKind | null {
  return t === "oral_presenter" ? "slides" : t === "poster_presenter" ? "poster" : null;
}

/** Whether a reviewer may approve this account (executive accounts need the president or VP). */
export function canApprove(reviewer: Access, target: AccountType) {
  return EXEC_TYPES.includes(target) ? reviewer.leadership && reviewer.exec : reviewer.exec;
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
