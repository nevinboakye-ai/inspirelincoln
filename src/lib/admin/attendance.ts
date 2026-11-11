import type { SupabaseClient } from "@supabase/supabase-js";
import { rolesOf } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export type Answer = "confirmed" | "unavailable" | "none";
export type PresenterRow = {
  key: string;
  name: string;
  email: string;
  institution: string | null;
  type: "oral_presenter" | "poster_presenter";
  title: string | null;
  /** "account" when they have logged in; "list" when they're only on the selected list so far. */
  source: "account" | "list";
  approved: boolean;
  answer: Answer;
  note: string | null;
  respondedAt: string | null;
};
export type WaitlistRow = {
  id: string;
  source: "account" | "list";
  name: string;
  email: string;
  institution: string | null;
  title: string | null;
  since: string;
};

const RELEVANT: AccountType[] = ["oral_presenter", "poster_presenter", "oral_waitlist"];

/**
 * What they present (oral, then poster), and whether they're on the oral
 * waiting list. Everyone on the waiting list also presents a poster, so they
 * appear in both lists.
 */
function presenting(main: AccountType, extra?: AccountType[] | null) {
  const roles = rolesOf(main, extra);
  const waiting = roles.includes("oral_waitlist");
  const type: PresenterRow["type"] | null = roles.includes("oral_presenter") ? "oral_presenter" : roles.includes("poster_presenter") || waiting ? "poster_presenter" : null;
  return { type, waiting };
}

/**
 * Everyone who should be presenting (accounts and selected-list entries not yet
 * turned into accounts), with their attendance answer, plus the oral waiting list
 * in the order people were added to it. Needs review_accounts access.
 */
export async function loadAttendance(db: SupabaseClient) {
  // Presenting can be an extra role (a committee member presenting a poster), so
  // filter here rather than in the query. "*" includes extra_types once setup file 21 has run.
  const [{ data: allProfiles }, { data: allRoster }, { data: answers }] = await Promise.all([
    db.from("profiles").select("*").neq("account_status", "declined").limit(5000),
    db.from("delegate_roster").select("*").limit(5000),
    db.from("presenter_attendance").select("user_id, response, note, responded_at"),
  ]);
  const relevant = (r: { account_type: AccountType; extra_types?: AccountType[] | null }) => rolesOf(r.account_type, r.extra_types).some((t) => RELEVANT.includes(t));
  const profiles = (allProfiles ?? []).filter(relevant);
  const roster = (allRoster ?? []).filter(relevant);

  const byUser = new Map((answers ?? []).map((a) => [a.user_id as string, a]));
  const withAccount = new Set((allProfiles ?? []).map((p) => (p.email as string).toLowerCase()));
  const listAdded = new Map((roster ?? []).map((r) => [r.email as string, r.added_at as string]));

  const presenters: PresenterRow[] = [];
  const waitlist: WaitlistRow[] = [];

  for (const p of profiles) {
    const role = presenting(p.account_type, p.extra_types);
    if (role.waiting) {
      waitlist.push({
        id: p.id,
        source: "account",
        name: p.full_name || p.email,
        email: p.email,
        institution: p.institution,
        title: p.presentation_title,
        since: listAdded.get((p.email as string).toLowerCase()) ?? p.created_at,
      });
    }
    if (!role.type) continue;
    const a = byUser.get(p.id);
    presenters.push({
      key: p.id,
      name: p.full_name || p.email,
      email: p.email,
      institution: p.institution,
      type: role.type,
      title: p.presentation_title,
      source: "account",
      approved: p.account_status === "approved",
      answer: (a?.response as Answer) ?? "none",
      note: a?.note ?? null,
      respondedAt: a?.responded_at ?? null,
    });
  }
  for (const r of roster) {
    if (withAccount.has(r.email)) continue;
    const role = presenting(r.account_type, r.extra_types);
    if (role.waiting) waitlist.push({ id: r.id, source: "list", name: r.full_name, email: r.email, institution: r.institution, title: r.presentation_title, since: r.added_at });
    if (!role.type) continue;
    presenters.push({
      key: r.id,
      name: r.full_name,
      email: r.email,
      institution: r.institution,
      type: role.type,
      title: r.presentation_title,
      source: "list",
      approved: false,
      answer: "none",
      note: null,
      respondedAt: null,
    });
  }

  // Answers needing attention first: can't make it, then no reply, then confirmed.
  const rank: Record<Answer, number> = { unavailable: 0, none: 1, confirmed: 2 };
  presenters.sort((a, b) => rank[a.answer] - rank[b.answer] || a.name.localeCompare(b.name));
  waitlist.sort((a, b) => a.since.localeCompare(b.since) || a.name.localeCompare(b.name));
  return { presenters, waitlist };
}
