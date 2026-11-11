"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { fromZonedInputValue } from "@/lib/time";
import { allocate, pairingProblems, type AllocWorkshop } from "@/lib/workshops/allocate";
import { loadAllocationBoard } from "@/lib/workshops/admin";

export type BoardResult = { ok: boolean; message?: string; error?: string } | null;

const PATH = "/admin/workshops";
const friendly = (m: string, fallback: string) =>
  m.includes("VIEW_AS")
    ? "You're viewing as someone else, so changes are switched off."
    : m.includes("NOTHING_TO_PUBLISH")
      ? "Run the allocation before publishing places."
      : m.includes("NOT_ALLOWED")
        ? "You don't have permission to manage workshop places."
        : fallback;
const refresh = () => {
  revalidatePath(PATH);
  revalidatePath("/portal");
};

/** Opens or closes ranking, sets the closing time, and publishes places. */
export async function saveChoiceSettings(_: BoardResult, form: FormData): Promise<BoardResult> {
  const { db } = await requireAccess("allocate_workshops", PATH);
  const raw = String(form.get("closes_at") ?? "").trim();
  const closesAt = raw ? fromZonedInputValue(raw) : null;
  if (raw && !closesAt) return { ok: false, error: "Enter the closing time as a date and time." };
  if (form.get("open") === "on") {
    // Delegates pick between the two workshops in each session, so the pairs must be set first.
    const { data: ed } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
    const { data: ws } = await db.from("workshops").select("slot, stream").eq("published", true).eq("edition_id", ed?.id ?? "");
    const pairs = new Map<number, number>();
    for (const w of ws ?? []) if (w.slot && w.stream) pairs.set(w.slot as number, (pairs.get(w.slot as number) ?? 0) + 1);
    const unset = (ws ?? []).some((w) => !w.slot || !w.stream);
    if (unset || pairs.size !== 3 || [...pairs.values()].some((n) => n !== 2))
      return { ok: false, error: "Put every workshop into a session as A or B (two per session) before opening choices." };
  }
  const { error } = await db.rpc("workshop_settings_save", {
    p_open: form.get("open") === "on",
    p_closes_at: closesAt,
    p_publish: form.get("publish") === "on",
  });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save that. Please try again.") };
  refresh();
  return { ok: true, message: "Saved." };
}

/** Which session each workshop runs in, A or B, and how many people each room holds. */
export async function saveWorkshopSessions(_: BoardResult, form: FormData): Promise<BoardResult> {
  const { db } = await requireAccess("allocate_workshops", PATH);
  const ids = form.getAll("id").map(String);
  const rows = ids.map((id) => {
    const slot = Number(form.get(`slot_${id}`)) || null;
    const stream = String(form.get(`stream_${id}`) ?? "");
    const capRaw = String(form.get(`capacity_${id}`) ?? "").trim();
    const capacity = capRaw ? Number(capRaw) : null;
    return { id, slot, stream: slot && (stream === "a" || stream === "b") ? stream : null, capacity };
  });
  if (rows.some((r) => r.capacity !== null && (!Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > 2000)))
    return { ok: false, error: "Room sizes must be whole numbers between 1 and 2000, or left empty." };
  if (rows.some((r) => r.slot && !r.stream)) return { ok: false, error: "Choose A or B for every workshop that has a session." };
  const seen = new Set<string>();
  for (const r of rows.filter((x) => x.slot)) {
    const k = `${r.slot}${r.stream}`;
    if (seen.has(k)) return { ok: false, error: `Two workshops are set to ${r.slot}${r.stream!.toUpperCase()}. Each place can only have one workshop.` };
    seen.add(k);
  }
  const { error } = await db.rpc("workshop_sessions_save", { p: rows.map((r) => ({ ...r, slot: r.slot ?? "", stream: r.stream ?? "", capacity: r.capacity ?? "" })) });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save the sessions. Please try again.") };
  refresh();
  revalidatePath("/workshops");
  return { ok: true, message: "Sessions and room sizes saved." };
}

/** Runs the allocation and saves it, replacing any earlier one (including moves made by hand). */
export async function runAllocation(_: BoardResult, form: FormData): Promise<BoardResult> {
  const { db, user } = await requireAccess("allocate_workshops", PATH);
  const board = await loadAllocationBoard(db, user.id);
  const ws: AllocWorkshop[] = board.workshops.filter((w) => w.slot && w.stream).map((w) => ({ id: w.id, slot: w.slot!, stream: w.stream!, capacity: w.capacity }));
  const problems = pairingProblems(ws);
  if (problems.length || ws.length !== board.workshops.length) return { ok: false, error: problems[0] ?? "Put every workshop in a session first." };
  const includeUnranked = form.get("unranked") === "on";
  // People who haven't ranked are only placed if they're delegates: committee members choose to take part by ranking.
  const people = board.people.filter((p) => p.ranking || (includeUnranked && !p.committee)).map((p) => ({ id: p.id, ranking: p.ranking }));
  if (!people.length) return { ok: false, error: "Nobody has ranked the workshops yet." };
  const seed = randomUUID();
  const result = allocate(ws, people, { seed, includeUnranked });
  const rows = [...result.placements].flatMap(([userId, slots]) =>
    [...slots].map(([slot, p]) => ({ user_id: userId, slot, workshop_id: p.workshopId, choice: p.choice ?? "" })),
  );
  const summary = { ...result.summary, includeUnranked, unplacedPeople: result.unplaced };
  const { error } = await db.rpc("workshop_allocation_replace", { p_rows: rows, p_summary: summary });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save the allocation. Please try again.") };
  refresh();
  const s = result.summary;
  return {
    ok: true,
    message: `Placed ${s.people} ${s.people === 1 ? "person" : "people"}. ${s.allPreferred} of ${s.ranked} who chose got their pick in every session.${s.unplaced ? ` ${s.unplaced} places couldn't be filled because both rooms were full.` : ""}`,
  };
}

/** Moves one person to a different workshop in the same session. */
export async function moveAllocation(userId: string, workshopId: string): Promise<BoardResult> {
  const { db } = await requireAccess("allocate_workshops", PATH);
  if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[0-9a-f-]{36}$/.test(workshopId)) return { ok: false, error: "Something went wrong. Please refresh and try again." };
  const { error } = await db.rpc("workshop_allocation_move", { p_user: userId, p_workshop: workshopId });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't move them. Please try again.") };
  const [{ data: w }, { count }] = await Promise.all([
    db.from("workshops").select("title, capacity").eq("id", workshopId).maybeSingle(),
    db.from("workshop_allocations").select("user_id", { count: "exact", head: true }).eq("workshop_id", workshopId),
  ]);
  refresh();
  const over = w?.capacity != null && count != null ? count - w.capacity : 0;
  return { ok: true, message: over > 0 ? `Moved. ${w!.title} now has ${over} more ${over === 1 ? "person" : "people"} than the room holds.` : "Moved." };
}
