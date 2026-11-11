import { ACCOUNT_TYPE_LABEL, ROLE_RANK } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

/** What a Delegate Card shows to someone allowed to see it (public.card_json). */
export type CardData = {
  id: string;
  full_name: string | null;
  institution: string | null;
  year_of_study: string | null;
  roles: AccountType[];
  committee_position: string | null;
  bio: string | null;
  linkedin_url: string | null;
  email: string | null;
  presentation_title: string | null;
};

/** Who a code belongs to and their attendance, for check-in staff only. */
export type CheckinInfo = {
  id: string;
  full_name: string | null;
  institution: string | null;
  roles: AccountType[];
  account_status: string;
  registration: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
};

export type CardLookup = {
  state: "signed_out" | "unknown" | "not_member" | "cards_off" | "hidden" | "ok" | "self";
  card?: CardData;
  saved?: boolean;
  note?: string | null;
  shared?: boolean;
  checkin?: CheckinInfo;
};

export type CheckInOutcome = {
  result: "checked_in" | "already" | "not_approved" | "no_event" | "unknown" | "undone" | `registration_${string}`;
  person?: Partial<CheckinInfo> & { id: string };
};

/** Codes are 16 characters from a-z and 2-9 without 0, 1, l or o. */
export const CARD_CODE = /^[a-km-np-z2-9]{16}$/;

export const cleanCode = (raw: string) => raw.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** "JB7G 2KXM PQ4R 8TWA", easy to read out or type. */
export const formatCode = (code: string) => code.toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");

export const cardPath = (code: string) => `/m/${code}`;

/**
 * Read whatever a scanner or keyboard gave us: a card link, a bare card code
 * (with or without spaces), or an older check-in code.
 */
export function parseScan(raw: string): { kind: "card"; code: string } | { kind: "ticket"; token: string } | null {
  const v = raw.trim();
  const ticket = v.match(/^INSPIRE-CHECKIN:([0-9a-f-]{36})$/i);
  if (ticket) return { kind: "ticket", token: ticket[1].toLowerCase() };
  const link = v.match(/\/m\/([A-Za-z0-9]{16})(?:[/?#]|$)/);
  if (link && CARD_CODE.test(link[1].toLowerCase())) return { kind: "card", code: link[1].toLowerCase() };
  if (/^https?:\/\//i.test(v)) return null;
  const code = cleanCode(v);
  return CARD_CODE.test(code) ? { kind: "card", code } : null;
}

export const sortedRoles = (roles: readonly AccountType[]) => ROLE_RANK.filter((t) => roles.includes(t));

/** Roles that already mean someone is attending, so "Delegate" isn't shown with them. */
export const PRESENTING = new Set<AccountType>(["oral_presenter", "poster_presenter", "oral_waitlist"]);

/**
 * Roles as people read them on a card. Presenters and the oral waiting list
 * don't also show "Delegate", and a single committee role reads better as
 * their position.
 */
export function cardRoles(c: Pick<CardData, "roles" | "committee_position">) {
  const roles = sortedRoles(c.roles);
  const attending = new Set<AccountType>(["delegate", ...PRESENTING]);
  const committee = roles.filter((t) => !attending.has(t));
  const presenting = roles.some((t) => PRESENTING.has(t));
  return roles
    .filter((t) => !(t === "delegate" && presenting))
    .map((t) => (!attending.has(t) && committee.length === 1 && c.committee_position ? c.committee_position : ACCOUNT_TYPE_LABEL[t]));
}

export const initials = (n: string | null) =>
  (n ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** A vCard 3.0 entry with only what the person shares, for phone contacts. */
export function toVCard(c: CardData, note?: string | null) {
  const name = (c.full_name ?? "").trim();
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts.pop()! : "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(name)}`,
    `N:${esc(last)};${esc(parts.join(" "))};;;`,
    c.institution && `ORG:${esc(c.institution)}`,
    `TITLE:${esc(cardRoles(c).join(", "))}`,
    c.email && `EMAIL;TYPE=INTERNET:${c.email}`,
    c.linkedin_url && `URL:${c.linkedin_url}`,
    `NOTE:${esc(["Met at INSPIRE", note?.trim()].filter(Boolean).join(". "))}`,
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSafe = (s: string | null) => (s ?? "contact").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "contact";
