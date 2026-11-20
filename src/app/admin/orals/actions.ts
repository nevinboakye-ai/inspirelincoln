"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { allocateOrals, toPlacements, type OralPlacement } from "@/lib/orals/allocate";
import { loadOralBoard } from "@/lib/orals/admin";

export type OralResult = { ok: boolean; message?: string; error?: string; version?: number; board?: OralPlacement[] } | null;

const PATH = "/admin/orals";
const UUID = /^[0-9a-f-]{36}$/i;
const friendly = (m: string, fallback: string) =>
  m.includes("VIEW_AS") || m.includes("read only")
    ? "You're viewing as someone else, so changes are switched off."
    : m.includes("STALE")
      ? "Someone else changed the rooms a moment ago. The page has been refreshed with their changes, so please make yours again."
      : m.includes("NOTHING_TO_PUBLISH")
        ? "Put presenters in rooms before showing the rooms to them."
        : m.includes("NOT_ALLOWED")
          ? "You don't have permission to change oral presentation rooms."
          : m.includes("BAD_SESSION")
            ? "One of the rooms has changed in the programme. Refresh the page and try again."
            : /does not exist|could not find/i.test(m)
              ? "This isn't set up yet: run the oral presentation rooms setup file in Supabase."
              : fallback;
const refresh = () => {
  revalidatePath(PATH);
  revalidatePath("/portal");
  revalidatePath("/portal/my-day");
  revalidatePath("/judge");
};

const toRows = (board: readonly OralPlacement[]) =>
  board.map((p) => ({ email: p.key, session_id: p.roomId ?? "", position: p.position, locked: p.locked }));

/** Saves the whole board, as the committee arranged it on the page. */
export async function saveOralBoard(version: number, board: OralPlacement[]): Promise<OralResult> {
  const { db } = await requireAccess("allocate_orals", PATH);
  if (!Number.isInteger(version) || !Array.isArray(board) || board.length > 500) return { ok: false, error: "Something went wrong. Please refresh and try again." };
  const bad = board.some(
    (p) => typeof p.key !== "string" || !p.key.includes("@") || p.key.length > 320 || (p.roomId !== null && !UUID.test(p.roomId)) || !Number.isInteger(p.position) || typeof p.locked !== "boolean",
  );
  if (bad) return { ok: false, error: "Something went wrong. Please refresh and try again." };
  const { data, error } = await db.rpc("oral_allocation_save", { p_version: version, p_rows: toRows(board), p_run: null });
  if (error) {
    refresh();
    return { ok: false, error: friendly(error.message, "We couldn't save that. Please try again.") };
  }
  refresh();
  return { ok: true, message: "Saved.", version: data as number };
}

/**
 * Shares everyone who isn't locked between the rooms at random, filling each
 * room up to the number of talks it takes, in a random running order.
 */
export async function runOralAllocation(_: OralResult, form: FormData): Promise<OralResult> {
  const { db } = await requireAccess("allocate_orals", PATH);
  const b = await loadOralBoard(db);
  if (!b.ready) return { ok: false, error: friendly(b.error, "We couldn't load the oral presenters. Please try again.") };
  if (b.rooms.length < 2) return { ok: false, error: "The programme needs two oral presentation sessions, one for each room." };
  if (!b.presenters.length) return { ok: false, error: "There are no oral presenters to place yet." };
  const version = Number(form.get("version"));
  const leaveOutAway = form.get("leave_out_unavailable") === "on";
  const leaveOut = new Set(leaveOutAway ? b.presenters.filter((p) => p.attendance === "unavailable").map((p) => p.key) : []);
  const seed = randomUUID();
  const result = allocateOrals(
    b.rooms.map((r) => ({ id: r.id, capacity: r.capacity })),
    b.presenters.map((p) => p.key),
    b.board,
    { seed, leaveOut },
  );
  const locked = new Set(b.board.filter((p) => p.locked).map((p) => p.key));
  const board = toPlacements(result, locked);
  const { data, error } = await db.rpc("oral_allocation_save", {
    p_version: Number.isInteger(version) ? version : null,
    p_rows: toRows(board),
    p_run: { at: new Date().toISOString(), seed, leftOut: leaveOut.size },
  });
  refresh();
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save the allocation. Please try again.") };
  const placed = [...result.rooms.values()].reduce((n, x) => n + x.length, 0);
  const kept = b.board.filter((p) => p.locked && p.roomId).length;
  const over = result.over.map((o) => `${b.rooms.find((r) => r.id === o.roomId)?.name ?? "A room"} has ${o.count} talks for ${o.capacity} slots`);
  return {
    ok: true,
    version: data as number,
    board,
    message: [
      `Placed ${placed} ${placed === 1 ? "presenter" : "presenters"}${kept ? `, keeping ${kept} locked ${kept === 1 ? "pick" : "picks"} where you put them` : ""}.`,
      result.unplaced.length ? `${result.unplaced.length} not in a room.` : "",
      over.length ? `Over capacity: ${over.join("; ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** How many talks each room takes. */
export async function saveOralRooms(_: OralResult, form: FormData): Promise<OralResult> {
  const { db } = await requireAccess("allocate_orals", PATH);
  const ids = form.getAll("id").map(String);
  const rows = ids.map((id) => {
    const raw = String(form.get(`capacity_${id}`) ?? "").trim();
    return { session_id: id, capacity: raw ? Number(raw) : null };
  });
  if (rows.some((r) => !UUID.test(r.session_id))) return { ok: false, error: "Something went wrong. Please refresh and try again." };
  if (rows.some((r) => r.capacity !== null && (!Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > 50)))
    return { ok: false, error: "The number of talks must be a whole number from 1 to 50, or left empty." };
  const { error } = await db.rpc("oral_rooms_save", { p: rows.map((r) => ({ session_id: r.session_id, capacity: r.capacity ?? "" })) });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save that. Please try again.") };
  revalidatePath(PATH);
  return { ok: true, message: "Saved." };
}

/** Shows or hides each presenter's room in My Hub, their day and the judges' list. */
export async function saveOralSettings(_: OralResult, form: FormData): Promise<OralResult> {
  const { db } = await requireAccess("allocate_orals", PATH);
  const publish = form.get("publish") === "on";
  const { error } = await db.rpc("oral_settings_save", { p_published: publish });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save that. Please try again.") };
  refresh();
  return {
    ok: true,
    message: publish ? "Presenters can now see their room and talk number in My Hub and in their day." : "Saved. Presenters no longer see their room.",
  };
}
