"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseScan, type CheckInOutcome, type CheckinInfo } from "@/lib/card";

type Res<T> = { ok: true; data: T } | { ok: false; error: string };
const UUID = /^[0-9a-f-]{36}$/i;

/** Check-in staff only. The database checks the same permission again. */
async function staff() {
  const current = await getCurrentUser();
  if (!current) return null;
  const a = current.profile.access;
  return a.can.check_in || a.can.manage_people || a.owner ? current : null;
}

const NOPE = { ok: false as const, error: "You don't have check-in access." };
const FAILED = { ok: false as const, error: "Check-in didn't go through. Check your connection and try again." };

/** Check in whoever a scanned or typed code belongs to. */
export async function checkInCode(raw: string): Promise<Res<CheckInOutcome>> {
  const s = await staff();
  if (!s) return NOPE;
  const parsed = parseScan(String(raw ?? ""));
  if (!parsed) return { ok: false, error: "That isn't an INSPIRE card code." };
  const { data, error } =
    parsed.kind === "card" ? await s.db.rpc("check_in_card", { code: parsed.code }) : await s.db.rpc("check_in_ticket", { token: parsed.token });
  if (error) return FAILED;
  revalidatePath("/admin/checkin");
  return { ok: true, data: data as CheckInOutcome };
}

export async function checkInPerson(id: string): Promise<Res<CheckInOutcome>> {
  const s = await staff();
  if (!s) return NOPE;
  if (!UUID.test(id)) return FAILED;
  const { data, error } = await s.db.rpc("check_in_person", { target: id });
  if (error) return FAILED;
  revalidatePath("/admin/checkin");
  return { ok: true, data: data as CheckInOutcome };
}

export async function undoCheckIn(id: string): Promise<Res<CheckInOutcome>> {
  const s = await staff();
  if (!s) return NOPE;
  if (!UUID.test(id)) return FAILED;
  const { data, error } = await s.db.rpc("undo_check_in", { target: id });
  if (error) return FAILED;
  revalidatePath("/admin/checkin");
  return { ok: true, data: data as CheckInOutcome };
}

export type SearchHit = Pick<CheckinInfo, "id" | "full_name" | "institution" | "roles" | "checked_in_at">;

export async function searchAttendees(q: string): Promise<Res<SearchHit[]>> {
  const s = await staff();
  if (!s) return NOPE;
  const query = String(q ?? "").trim().slice(0, 120);
  if (query.length < 2) return { ok: true, data: [] };
  const { data, error } = await s.db.rpc("check_in_search", { q: query });
  if (error) return { ok: false, error: "Search isn't working just now." };
  return { ok: true, data: (data ?? []) as SearchHit[] };
}

export type Recent = { id: string; full_name: string | null; checked_in_at: string };

/** Counts and the latest check-ins, so every desk stays in step. */
export async function deskStatus(): Promise<Res<{ expected: number; checkedIn: number; recent: Recent[] }>> {
  const s = await staff();
  if (!s) return NOPE;
  const [{ data: c }, { data: r }] = await Promise.all([s.db.rpc("checkin_counts"), s.db.rpc("recent_check_ins")]);
  const row = (Array.isArray(c) ? c[0] : c) as { confirmed: number; checked_in: number } | undefined;
  return { ok: true, data: { expected: Number(row?.confirmed ?? 0), checkedIn: Number(row?.checked_in ?? 0), recent: (r ?? []) as Recent[] } };
}
