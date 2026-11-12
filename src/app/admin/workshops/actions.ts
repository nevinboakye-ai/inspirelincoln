"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { fromZonedInputValue } from "@/lib/time";
import { allocate, SESSIONS, type AllocWorkshop } from "@/lib/workshops/allocate";
import { loadAllocationBoard } from "@/lib/workshops/admin";
import { WORKSHOP_ROOMS } from "@/lib/workshops/rooms";

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
    // Delegates rank every workshop, and go to one per session, so there must be at least one per session.
    const { data: ed } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
    const { count } = await db.from("workshops").select("id", { count: "exact", head: true }).eq("published", true).eq("edition_id", ed?.id ?? "");
    if ((count ?? 0) < SESSIONS) return { ok: false, error: `Publish at least ${SESSIONS} workshops before opening ranking.` };
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

/** The room each workshop runs in, and how many people it holds in one session. */
export async function saveWorkshopRooms(_: BoardResult, form: FormData): Promise<BoardResult> {
  const { db } = await requireAccess("allocate_workshops", PATH);
  const ids = form.getAll("id").map(String);
  const rows = ids.map((id) => {
    const room = String(form.get(`room_${id}`) ?? "").trim();
    const capRaw = String(form.get(`capacity_${id}`) ?? "").trim();
    return { id, room, capacity: capRaw ? Number(capRaw) : null };
  });
  if (rows.some((r) => !/^[0-9a-f-]{36}$/.test(r.id))) return { ok: false, error: "Something went wrong. Please refresh and try again." };
  if (rows.some((r) => r.room && !(WORKSHOP_ROOMS as readonly string[]).includes(r.room))) return { ok: false, error: "Choose a room from the list." };
  if (rows.some((r) => r.capacity !== null && (!Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > 2000)))
    return { ok: false, error: "Room sizes must be whole numbers between 1 and 2000, or left empty." };
  const taken = rows.filter((r) => r.room).map((r) => r.room);
  const twice = taken.find((r, i) => taken.indexOf(r) !== i);
  if (twice) return { ok: false, error: `${twice} is set for two workshops. All six run at the same time, so each needs its own room.` };
  const { error } = await db.rpc("workshop_rooms_save", { p: rows.map((r) => ({ id: r.id, room: r.room, capacity: r.capacity ?? "" })) });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save the rooms. Please try again.") };
  refresh();
  revalidatePath("/workshops");
  return { ok: true, message: "Rooms and room sizes saved." };
}

/** Runs the allocation and saves it, replacing any earlier one (including moves made by hand). */
export async function runAllocation(_: BoardResult, form: FormData): Promise<BoardResult> {
  const { db, user } = await requireAccess("allocate_workshops", PATH);
  const board = await loadAllocationBoard(db, user.id);
  const ws: AllocWorkshop[] = board.workshops.map((w) => ({ id: w.id, capacity: w.capacity }));
  if (ws.length < SESSIONS) return { ok: false, error: `There need to be at least ${SESSIONS} published workshops.` };
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
    message: `Placed ${s.people} ${s.people === 1 ? "person" : "people"}. ${s.allTop} of ${s.ranked} who ranked got all of their top three.${s.unplaced ? ` ${s.unplaced} ${s.unplaced === 1 ? "place" : "places"} couldn't be filled because every room was full.` : ""}`,
  };
}

/**
 * Puts one person in a workshop for one session. If they're already doing
 * that workshop in another session, the two sessions swap. An empty
 * workshop takes them out of that session.
 */
export async function setPlace(userId: string, slot: number, workshopId: string | null): Promise<BoardResult> {
  const { db } = await requireAccess("allocate_workshops", PATH);
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(userId) || (workshopId && !uuid.test(workshopId)) || !Number.isInteger(slot) || slot < 1 || slot > SESSIONS)
    return { ok: false, error: "Something went wrong. Please refresh and try again." };
  const { error } = await db.rpc("workshop_allocation_set", { p_user: userId, p_slot: slot, p_workshop: workshopId });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't move them. Please try again.") };
  refresh();
  // Warn if a room is now over its size in any session.
  const { data: ed } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
  const [{ data: ws }, { data: places }] = await Promise.all([
    db.from("workshops").select("id, title, capacity").eq("edition_id", ed?.id ?? "").eq("published", true),
    db.from("workshop_allocations").select("slot, workshop_id").eq("edition_id", ed?.id ?? ""),
  ]);
  const over = (ws ?? []).flatMap((w) =>
    [1, 2, 3].flatMap((s) => {
      const n = (places ?? []).filter((p) => p.workshop_id === w.id && p.slot === s).length;
      return w.capacity != null && n > w.capacity ? [`${w.title} in session ${s} (${n} for ${w.capacity} places)`] : [];
    }),
  );
  return { ok: true, message: over.length ? `Saved. Over the room size: ${over.join("; ")}.` : "Saved." };
}
