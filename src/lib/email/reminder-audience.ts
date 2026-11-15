import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/view-as";
import { isJudgeOnly, rolesOf } from "@/lib/accounts";
import { rankingIsOpen } from "@/lib/workshops/choices";
import type { AccountStatus, AccountType, SubmissionKind, SubmissionStatus } from "@/lib/types";
import type { ReminderPerson } from "./reminders";

/** Reads every row of a table in pages, since Supabase returns at most 1000 at a time. */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Sign-in times for every account, from Supabase Auth. */
async function signIns(admin: SupabaseClient) {
  const seen = new Map<string, boolean>();
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) seen.set(u.id, Boolean(u.last_sign_in_at));
    if (data.users.length < 1000) break;
  }
  return seen;
}

export type ReminderAudience = {
  people: ReminderPerson[];
  /** When workshop ranking closes, if it's open: a sensible default deadline. */
  rankingClosesAt: string | null;
};

/**
 * Everyone with a place (approved accounts and people on the selected list
 * who haven't joined), with what they have and haven't done. Needs the
 * server's secret key, because it reads across everyone's accounts and
 * Supabase Auth's sign-in times.
 */
export async function loadReminderAudience(): Promise<{ ok: true; audience: ReminderAudience } | { ok: false; error: string }> {
  const admin = serviceClient();
  if (!admin) return { ok: false, error: "Reminders need SUPABASE_SERVICE_ROLE_KEY in Vercel, to see who has signed in. Add it and redeploy." };
  try {
    const { data: ed } = await admin.from("editions").select("id").eq("is_current", true).maybeSingle();
    const editionId = (ed?.id as string | undefined) ?? null;

    const [profiles, roster, subs, attendance, travel, logins, settings, workshops, rankings] = await Promise.all([
      all<{
        id: string;
        email: string | null;
        full_name: string | null;
        institution: string | null;
        account_type: AccountType;
        extra_types: AccountType[] | null;
        account_status: AccountStatus;
        avatar_path: string | null;
        bio: string | null;
      }>((a, b) => admin.from("profiles").select("id, email, full_name, institution, account_type, extra_types, account_status, avatar_path, bio").order("id").range(a, b)),
      all<{ email: string; full_name: string | null; institution: string | null; account_type: AccountType; extra_types: AccountType[] | null }>((a, b) =>
        admin.from("delegate_roster").select("email, full_name, institution, account_type, extra_types").order("email").range(a, b),
      ),
      all<{ user_id: string; kind: SubmissionKind; status: SubmissionStatus; version: number }>((a, b) =>
        admin.from("presentation_submissions").select("user_id, kind, status, version").order("id").range(a, b),
      ),
      all<{ user_id: string; response: "confirmed" | "unavailable" }>((a, b) => admin.from("presenter_attendance").select("user_id, response").order("user_id").range(a, b)),
      // Before setup SQL 36 there's no travel table; treat that as nobody needing to answer.
      all<{ user_id: string }>((a, b) => admin.from("delegate_travel").select("user_id").order("user_id").range(a, b)).catch(() => null),
      signIns(admin),
      editionId
        ? admin.from("workshop_choice_settings").select("ranking_open, closes_at").eq("edition_id", editionId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      editionId ? admin.from("workshops").select("id").eq("edition_id", editionId).eq("published", true) : Promise.resolve({ data: [], error: null }),
      editionId
        ? all<{ user_id: string; ranking: string[] | null }>((a, b) => admin.from("workshop_rankings").select("user_id, ranking").eq("edition_id", editionId).order("user_id").range(a, b)).catch(() => [])
        : Promise.resolve([]),
    ]);

    const s = settings.data as { ranking_open?: boolean; closes_at?: string | null } | null;
    const workshopIds = new Set(((workshops.data ?? []) as { id: string }[]).map((w) => w.id));
    const open = Boolean(s && workshopIds.size && rankingIsOpen({ rankingOpen: Boolean(s.ranking_open), closesAt: s.closes_at ?? null, resultsPublished: false, ready: true }));
    // A ranking made before a workshop was added or removed doesn't count, as on the workshop places page.
    const ranked = new Set(rankings.filter((r) => r.ranking && r.ranking.length === workshopIds.size && r.ranking.every((x) => workshopIds.has(x))).map((r) => r.user_id));

    const latest = new Map<string, { status: SubmissionStatus; version: number }>();
    for (const x of subs) {
      const k = `${x.user_id}:${x.kind}`;
      const cur = latest.get(k);
      if (!cur || x.version > cur.version) latest.set(k, { status: x.status, version: x.version });
    }
    const attend = new Map(attendance.map((a) => [a.user_id, a.response]));
    const travelled = travel ? new Set(travel.map((t) => t.user_id)) : null;

    const people: ReminderPerson[] = [];
    const seen = new Set<string>();
    for (const p of profiles) {
      const email = p.email?.toLowerCase();
      if (!email || p.account_status !== "approved") {
        if (email) seen.add(email);
        continue;
      }
      seen.add(email);
      const roles = rolesOf(p.account_type, p.extra_types);
      const judgeOnly = isJudgeOnly(p.account_type, p.extra_types);
      people.push({
        email,
        fullName: p.full_name,
        institution: p.institution,
        joined: true,
        signedIn: logins.get(p.id) ?? false,
        roles,
        photo: Boolean(p.avatar_path),
        details: Boolean(p.full_name?.trim() && p.institution?.trim()),
        bio: p.bio,
        // Judges aren't asked how they're travelling or to rank workshops.
        travel: travelled && !judgeOnly ? travelled.has(p.id) : true,
        ranked: open && !judgeOnly ? ranked.has(p.id) : null,
        attendance: attend.get(p.id) ?? null,
        submissions: {
          slides: latest.get(`${p.id}:slides`)?.status ?? null,
          poster: latest.get(`${p.id}:poster`)?.status ?? null,
        },
      });
    }
    // On the selected list but no account yet: nothing done, and they've never signed in.
    for (const r of roster) {
      const email = r.email.toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      people.push({
        email,
        fullName: r.full_name,
        institution: r.institution,
        joined: false,
        signedIn: false,
        roles: rolesOf(r.account_type, r.extra_types),
        photo: false,
        // Their university is copied from the list when they join.
        details: Boolean(r.full_name?.trim() && r.institution?.trim()),
        bio: null,
        travel: travelled ? false : true,
        ranked: open ? false : null,
        attendance: null,
        submissions: {},
      });
    }
    people.sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email, "en-GB"));
    return { ok: true, audience: { people, rankingClosesAt: open ? (s?.closes_at ?? null) : null } };
  } catch (e) {
    console.error("[reminders] could not load the audience", e);
    return { ok: false, error: "Could not load who still has tasks to do. Try again in a moment." };
  }
}
