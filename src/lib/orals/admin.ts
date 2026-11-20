import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTime } from "@/lib/time";
import { cleanRoomName } from "@/lib/orals/room-name";
import type { OralPlacement } from "@/lib/orals/allocate";

export type OralBoardRoom = {
  /** The programme session for this room. */
  id: string;
  title: string;
  /** The room's name, e.g. "LMS0005". */
  name: string;
  building: string | null;
  capacity: number | null;
  time: string | null;
  startsAt: string | null;
};
export type OralPerson = {
  /** Their email, which is how they're matched. */
  key: string;
  userId: string | null;
  name: string;
  institution: string | null;
  title: string | null;
  approved: boolean;
  /** Whether they've said they'll be there to present. */
  attendance: "confirmed" | "unavailable" | null;
};
export type OralLastRun = { at: string; seed: string; leftOut: number } | null;


/** The room part of "Oral presentations: LMS0005". */
const fromTitle = (t: string) => t.split(/:\s/).slice(1).join(": ").trim() || t;

/** Everything the committee's oral rooms page needs. Null when setup hasn't been run. */
export async function loadOralBoard(db: SupabaseClient) {
  const [ids, people, places, settings] = await Promise.all([
    db.rpc("oral_sessions"),
    db.rpc("oral_presenter_people"),
    db.from("oral_allocations").select("email, session_id, position, locked"),
    db.from("oral_room_settings").select("published, version, last_run, updated_at").maybeSingle(),
  ]);
  const error = ids.error ?? people.error ?? places.error ?? settings.error;
  if (error) return { ready: false as const, error: error.message };

  const sessionIds = ((ids.data ?? []) as (string | { oral_sessions: string })[]).map((x) => (typeof x === "string" ? x : x.oral_sessions));
  const [{ data: sessions }, { data: caps }] = await Promise.all([
    sessionIds.length
      ? db.from("sessions").select("id, title, starts_at, ends_at, sort, rooms(name, building)").in("id", sessionIds)
      : Promise.resolve({ data: [] }),
    sessionIds.length ? db.from("oral_rooms").select("session_id, capacity").in("session_id", sessionIds) : Promise.resolve({ data: [] }),
  ]);
  type S = { id: string; title: string; starts_at: string | null; ends_at: string | null; sort: number; rooms: { name: string; building: string | null } | null };
  const capOf = new Map(((caps ?? []) as { session_id: string; capacity: number | null }[]).map((c) => [c.session_id, c.capacity]));
  const rooms: OralBoardRoom[] = ((sessions ?? []) as unknown as S[])
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "") || a.sort - b.sort)
    .map((s) => ({
      id: s.id,
      title: s.title,
      name: s.rooms?.name ? cleanRoomName(s.rooms.name) : fromTitle(s.title),
      building: s.rooms?.building ?? null,
      capacity: capOf.get(s.id) ?? null,
      time: s.starts_at ? `${formatTime(s.starts_at)}${s.ends_at ? ` to ${formatTime(s.ends_at)}` : ""}` : null,
      startsAt: s.starts_at,
    }));

  type P = { email: string; user_id: string | null; full_name: string | null; institution: string | null; title: string | null; approved: boolean; attendance: string | null };
  const seen = new Set<string>();
  const presenters: OralPerson[] = [];
  for (const p of (people.data ?? []) as P[]) {
    const key = p.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    presenters.push({
      key,
      userId: p.user_id,
      name: p.full_name || p.email,
      institution: p.institution,
      title: p.title,
      approved: p.approved,
      attendance: p.attendance === "confirmed" || p.attendance === "unavailable" ? p.attendance : null,
    });
  }
  presenters.sort((a, b) => a.name.localeCompare(b.name));

  const roomIds = new Set(rooms.map((r) => r.id));
  const board: OralPlacement[] = ((places.data ?? []) as { email: string; session_id: string | null; position: number; locked: boolean }[]).map((p) => ({
    key: p.email,
    // A room taken out of the programme: back to "not in a room".
    roomId: p.session_id && roomIds.has(p.session_id) ? p.session_id : null,
    position: p.position,
    locked: p.locked,
  }));
  const s = settings.data as { published: boolean; version: number; last_run: OralLastRun; updated_at: string } | null;
  return {
    ready: true as const,
    rooms,
    presenters,
    board,
    published: Boolean(s?.published),
    version: s?.version ?? 0,
    lastRun: s?.last_run ?? null,
    updatedAt: s?.updated_at ?? null,
  };
}
export type OralBoard = Extract<Awaited<ReturnType<typeof loadOralBoard>>, { ready: true }>;
