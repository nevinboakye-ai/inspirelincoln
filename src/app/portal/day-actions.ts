"use server";
import { getCurrentUser } from "@/lib/auth";
import { signAvatar } from "@/lib/avatar";
import { parseScan } from "@/lib/card";
import { dayContext, personDay, type DayPersonRow } from "@/lib/day/server";
import type { DayItem } from "@/lib/day/plan";
import type { AccountType } from "@/lib/types";

/**
 * The on-the-day scanner in My Hub. Every function checks the permission
 * here, and the database checks it again.
 */

type Res<T> = { ok: true; data: T } | { ok: false; error: string };
const UUID = /^[0-9a-f-]{36}$/i;
const NOPE = { ok: false as const, error: "You don't have access to the scanner." };
const FAILED = { ok: false as const, error: "That didn't go through. Check your connection and try again." };
const NOT_SET_UP = { ok: false as const, error: "The scanner isn't set up yet: run setup SQL 42 in Supabase." };

export type ScanPerson = {
  id: string;
  name: string;
  institution: string | null;
  yearOfStudy: string | null;
  roles: AccountType[];
  position: string | null;
  photo: string | null;
  needs: string | null;
  accountStatus: string;
  registration: string | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
};
export type ScanView = { person: ScanPerson; items: DayItem[] };
export type MarkResult = "marked" | "already" | "changed" | "no_place" | "not_approved" | "no_event" | "unknown" | "undone";
export type MarkOutcome = { result: MarkResult; checkedInNow: boolean; workshopId: string | null; view: ScanView | null };

async function scanner() {
  const current = await getCurrentUser();
  if (!current) return null;
  const a = current.profile.access;
  return a.owner || a.can.day_scanner || a.can.check_in || a.can.manage_people || a.can.allocate_workshops ? current : null;
}

type Current = NonNullable<Awaited<ReturnType<typeof scanner>>>;

async function view(s: Current, row: DayPersonRow | null): Promise<ScanView | null> {
  if (!row) return null;
  const [ctx, photo] = await Promise.all([dayContext(), signAvatar(s.db, row.avatar_path)]);
  return {
    person: {
      id: row.id,
      name: row.full_name || "No name given",
      institution: row.institution,
      yearOfStudy: row.year_of_study,
      roles: (row.roles ?? []) as AccountType[],
      position: row.committee_position,
      photo,
      needs: row.accessibility_needs,
      accountStatus: row.account_status,
      registration: row.registration,
      checkedInAt: row.checked_in_at,
      checkedInBy: row.checked_in_by,
    },
    items: personDay(ctx, row),
  };
}

const missing = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === "PGRST202" || e.code === "42883" || /does not exist|could not find/i.test(e.message ?? "")));

/** Whoever a scanned or typed code belongs to, with their day. */
export async function scanLookup(raw: string): Promise<Res<ScanView | null>> {
  const s = await scanner();
  if (!s) return NOPE;
  const parsed = parseScan(String(raw ?? ""));
  if (!parsed) return { ok: false, error: "That isn't an INSPIRE card code." };
  const { data, error } = await s.db.rpc("day_find", parsed.kind === "card" ? { p_code: parsed.code } : { p_token: parsed.token });
  if (missing(error)) return NOT_SET_UP;
  if (error) return FAILED;
  return { ok: true, data: await view(s, data as DayPersonRow | null) };
}

export async function scanPerson(id: string): Promise<Res<ScanView | null>> {
  const s = await scanner();
  if (!s) return NOPE;
  if (!UUID.test(id)) return FAILED;
  const { data, error } = await s.db.rpc("day_person", { target: id });
  if (missing(error)) return NOT_SET_UP;
  if (error) return FAILED;
  return { ok: true, data: await view(s, data as DayPersonRow | null) };
}

export type ScanHit = { id: string; full_name: string | null; institution: string | null; roles: AccountType[]; checked_in_at: string | null };

export async function scanSearch(q: string): Promise<Res<ScanHit[]>> {
  const s = await scanner();
  if (!s) return NOPE;
  const query = String(q ?? "").trim().slice(0, 120);
  if (query.length < 2) return { ok: true, data: [] };
  const { data, error } = await s.db.rpc("day_search", { q: query });
  if (missing(error)) return NOT_SET_UP;
  if (error) return { ok: false, error: "Search isn't working just now." };
  return { ok: true, data: (data ?? []) as ScanHit[] };
}

/** Mark someone at a workshop. Without a workshop, the one they were placed in for that session. */
export async function markWorkshop(id: string, slot: number, workshopId?: string | null): Promise<Res<MarkOutcome>> {
  const s = await scanner();
  if (!s) return NOPE;
  if (!UUID.test(id) || ![1, 2, 3].includes(slot) || (workshopId && !UUID.test(workshopId))) return FAILED;
  const { data, error } = await s.db.rpc("mark_workshop_attendance", { target: id, p_slot: slot, p_workshop: workshopId ?? null });
  if (missing(error)) return NOT_SET_UP;
  if (error) return FAILED;
  const d = data as { result: MarkResult; checked_in_now?: boolean; workshop_id?: string; person?: DayPersonRow };
  return { ok: true, data: { result: d.result, checkedInNow: Boolean(d.checked_in_now), workshopId: d.workshop_id ?? null, view: await view(s, d.person ?? null) } };
}

export async function unmarkWorkshop(id: string, slot: number): Promise<Res<MarkOutcome>> {
  const s = await scanner();
  if (!s) return NOPE;
  if (!UUID.test(id) || ![1, 2, 3].includes(slot)) return FAILED;
  const { data, error } = await s.db.rpc("unmark_workshop_attendance", { target: id, p_slot: slot });
  if (error) return FAILED;
  const d = data as { person?: DayPersonRow };
  return { ok: true, data: { result: "undone", checkedInNow: false, workshopId: null, view: await view(s, d.person ?? null) } };
}

/** Check someone in to the conference from the scanner. Needs the check-in permission. */
export async function scanCheckIn(id: string): Promise<Res<{ result: string; view: ScanView | null }>> {
  const s = await scanner();
  if (!s) return NOPE;
  const a = s.profile.access;
  if (!(a.owner || a.can.check_in || a.can.manage_people)) return { ok: false, error: "Checking people in needs the Check-in desk permission." };
  if (!UUID.test(id)) return FAILED;
  const { data, error } = await s.db.rpc("check_in_person", { target: id });
  if (error) return FAILED;
  const r = await s.db.rpc("day_person", { target: id });
  return { ok: true, data: { result: (data as { result: string }).result, view: await view(s, (r.data as DayPersonRow | null) ?? null) } };
}
