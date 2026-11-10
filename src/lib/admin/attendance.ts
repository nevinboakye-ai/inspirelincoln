import type { SupabaseClient } from "@supabase/supabase-js";

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

const PRESENTER_TYPES = ["oral_presenter", "poster_presenter"] as const;

/**
 * Everyone who should be presenting (accounts and selected-list entries not yet
 * turned into accounts), with their attendance answer, plus the oral waiting list
 * in the order people were added to it. Needs review_accounts access.
 */
export async function loadAttendance(db: SupabaseClient) {
  const [{ data: profiles }, { data: roster }, { data: answers }] = await Promise.all([
    db
      .from("profiles")
      .select("id, email, full_name, institution, account_type, account_status, presentation_title, created_at")
      .in("account_type", [...PRESENTER_TYPES, "oral_waitlist"])
      .neq("account_status", "declined"),
    db
      .from("delegate_roster")
      .select("id, email, full_name, institution, account_type, presentation_title, added_at")
      .in("account_type", [...PRESENTER_TYPES, "oral_waitlist"]),
    db.from("presenter_attendance").select("user_id, response, note, responded_at"),
  ]);

  const byUser = new Map((answers ?? []).map((a) => [a.user_id as string, a]));
  const withAccount = new Set((profiles ?? []).map((p) => (p.email as string).toLowerCase()));
  const listAdded = new Map((roster ?? []).map((r) => [r.email as string, r.added_at as string]));

  const presenters: PresenterRow[] = [];
  const waitlist: WaitlistRow[] = [];

  for (const p of profiles ?? []) {
    if (p.account_type === "oral_waitlist") {
      waitlist.push({
        id: p.id,
        source: "account",
        name: p.full_name || p.email,
        email: p.email,
        institution: p.institution,
        title: p.presentation_title,
        since: listAdded.get((p.email as string).toLowerCase()) ?? p.created_at,
      });
      continue;
    }
    const a = byUser.get(p.id);
    presenters.push({
      key: p.id,
      name: p.full_name || p.email,
      email: p.email,
      institution: p.institution,
      type: p.account_type,
      title: p.presentation_title,
      source: "account",
      approved: p.account_status === "approved",
      answer: (a?.response as Answer) ?? "none",
      note: a?.note ?? null,
      respondedAt: a?.responded_at ?? null,
    });
  }
  for (const r of roster ?? []) {
    if (withAccount.has(r.email)) continue;
    if (r.account_type === "oral_waitlist") {
      waitlist.push({ id: r.id, source: "list", name: r.full_name, email: r.email, institution: r.institution, title: r.presentation_title, since: r.added_at });
      continue;
    }
    presenters.push({
      key: r.id,
      name: r.full_name,
      email: r.email,
      institution: r.institution,
      type: r.account_type,
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
