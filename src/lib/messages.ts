/** Direct messages between people with accounts. Mirrors public.dm_* in the database. */
import { ACCOUNT_TYPE_LABEL, COMMITTEE_TYPES, EXEC_TYPES } from "@/lib/accounts";
import type { AccountStatus, AccountType } from "@/lib/types";

export { dayLabel, sameDay, shortWhen, timeOf } from "@/lib/enquiries";

export const DM_BODY_MAX = 4000;

export type DmMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_name: string;
  from_committee: boolean;
  body: string;
  created_at: string;
};
export const DM_MESSAGE_COLUMNS = "id, conversation_id, sender_id, sender_name, from_committee, body, created_at";

/** One row of someone's inbox (public.dm_inbox). */
export type InboxRow = {
  conversation_id: string;
  other_id: string | null;
  other_name: string;
  other_institution: string | null;
  other_roles: AccountType[] | null;
  other_position: string | null;
  other_avatar_path: string | null;
  last_message_at: string;
  last_body: string | null;
  last_from_me: boolean;
  unread: number;
  other_read_at: string | null;
  blocked_by_me: boolean;
  can_send: boolean;
  /** A short-lived link to their photo, added by the server. */
  other_photo?: string | null;
};

/** The other person in one conversation (public.dm_peer). */
export type Peer = {
  other_id: string | null;
  other_name: string;
  other_institution: string | null;
  other_year: string | null;
  other_roles: AccountType[] | null;
  other_position: string | null;
  other_avatar_path: string | null;
  other_read_at: string | null;
  my_cleared_at: string | null;
  blocked_by_me: boolean;
  can_send: boolean;
  why_not: string | null;
  other_photo?: string | null;
};

/** Someone you can start a conversation with (public.dm_contacts). */
export type Contact = {
  id: string;
  full_name: string;
  institution: string | null;
  year_of_study: string | null;
  roles: AccountType[];
  committee_position: string | null;
  avatar_path: string | null;
  account_status: AccountStatus;
  photo?: string | null;
};

/** What the menu badge and the new-message pop-up need (public.dm_unread_summary). */
export type UnreadSummary = {
  conversations: number;
  latest: { id: string; conversation: string; name: string; body: string; at: string } | null;
};

export const isCommitteeRole = (roles: readonly AccountType[] | null | undefined) => Boolean(roles?.some((r) => COMMITTEE_TYPES.includes(r)));
export const isExecRole = (roles: readonly AccountType[] | null | undefined) => Boolean(roles?.some((r) => EXEC_TYPES.includes(r)));

/** "Executive committee", "Oral presenter", "Delegate": the one role worth showing beside a name. */
export function headlineRole(roles: readonly AccountType[] | null | undefined, position?: string | null) {
  if (!roles?.length) return null;
  const committee = roles.find((r) => COMMITTEE_TYPES.includes(r));
  if (committee) return position || ACCOUNT_TYPE_LABEL[committee];
  const presenting = roles.find((r) => r === "oral_presenter" || r === "poster_presenter");
  return ACCOUNT_TYPE_LABEL[presenting ?? roles[0]];
}

/** The groups the committee can filter people by when starting a message. */
export const CONTACT_GROUPS = {
  all: { label: "Everyone", match: () => true },
  delegates: { label: "Delegates", match: (c: Contact) => !isCommitteeRole(c.roles) && !c.roles.some((r) => r.endsWith("presenter") || r === "oral_waitlist") },
  oral: { label: "Oral presenters", match: (c: Contact) => c.roles.includes("oral_presenter") },
  poster: { label: "Poster presenters", match: (c: Contact) => c.roles.includes("poster_presenter") },
  committee: { label: "Committee", match: (c: Contact) => isCommitteeRole(c.roles) },
  pending: { label: "Not yet approved", match: (c: Contact) => c.account_status !== "approved" },
} as const;
export type ContactGroup = keyof typeof CONTACT_GROUPS;

/**
 * Ready-made requests the committee can drop into a message and edit,
 * for the things they most often need people to do.
 */
export const COMMITTEE_TEMPLATES: { label: string; body: string }[] = [
  { label: "Add a photo", body: "Hi {first}, could you add a profile photo to your INSPIRE account? It goes on your Delegate Card and helps us recognise you on the day. You can add it under Profile and privacy in My Hub. Thank you!" },
  { label: "Finish your profile", body: "Hi {first}, your INSPIRE profile still has a few gaps. Could you log in to My Hub and complete it (university, year of study and dietary or access needs)? Thank you!" },
  { label: "Write your biography", body: "Hi {first}, could you add a short biography (about 100 words) to your profile? We use it in the post-conference booklet and on your certificate, so please write it in the third person. Thank you!" },
  { label: "Upload slides or poster", body: "Hi {first}, we haven't received your presentation yet. Could you upload it under My submission in My Hub as soon as you can? We need it for the programme, the booklet and your certificate. Thank you!" },
  { label: "Rank workshops", body: "Hi {first}, you haven't ranked your workshop choices yet. Please do this in My Hub before the deadline so we can give you a place you'll enjoy." },
  { label: "Check your details", body: "Hi {first}, could you check a detail on your account for us? " },
];

/** Fill a template's {first} with someone's first name, or drop it for a group. */
export function fillTemplate(body: string, name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? body.replaceAll("{first}", first) : body.replace(/Hi \{first\}, /g, "Hi, ").replaceAll("{first}", "");
}

/** "You: thanks!" or just the preview text. */
export function previewLine(r: Pick<InboxRow, "last_body" | "last_from_me">) {
  const body = (r.last_body ?? "").replace(/\s+/g, " ").trim();
  return r.last_from_me ? `You: ${body}` : body;
}
