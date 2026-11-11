import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTime } from "@/lib/time";

export type ChoiceWorkshop = {
  id: string;
  number: number;
  slug: string;
  title: string;
  strapline: string;
  slot: number | null;
  stream: "a" | "b" | null;
  capacity: number | null;
};
export type SessionTime = { slot: number; title: string; time: string | null; room: string | null };
export type ChoiceSettings = { rankingOpen: boolean; closesAt: string | null; resultsPublished: boolean; ready: boolean };
export type MyPlace = { slot: number; workshopId: string; choice: number | null };

/** "1A", or null until the committee has put the workshop in a session. */
export const pairLabel = (w: Pick<ChoiceWorkshop, "slot" | "stream">) => (w.slot && w.stream ? `${w.slot}${w.stream.toUpperCase()}` : null);

/** Whether delegates can still change their ranking right now. */
export const rankingIsOpen = (s: ChoiceSettings, now = Date.now()) => s.rankingOpen && (!s.closesAt || new Date(s.closesAt).getTime() > now);
/** True once a closing time has been set and has passed. */
export const closingTimePassed = (s: ChoiceSettings, now = Date.now()) => Boolean(s.closesAt && new Date(s.closesAt).getTime() <= now);

/**
 * Everything the workshop choice screens need: the workshops, the three
 * workshop sessions in time order (session 1 is the earliest), the
 * settings, and this person's ranking and places. `ready` is false until
 * the database set-up has been run.
 */
export async function loadWorkshopChoices(db: SupabaseClient, userId: string) {
  const { data: ed } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
  const editionId = (ed?.id as string | undefined) ?? null;
  const empty = {
    editionId,
    workshops: [] as ChoiceWorkshop[],
    sessions: [] as SessionTime[],
    settings: { rankingOpen: false, closesAt: null, resultsPublished: false, ready: false } as ChoiceSettings,
    ranking: null as string[] | null,
    rankedAt: null as string | null,
    places: [] as MyPlace[],
  };
  if (!editionId) return empty;

  const [ws, sessions, settings, mine, places] = await Promise.all([
    db.from("workshops").select("id, number, slug, title, strapline, slot, stream, capacity").eq("edition_id", editionId).eq("published", true).order("number"),
    db.from("sessions").select("title, starts_at, ends_at, rooms(name)").eq("edition_id", editionId).eq("category", "workshop").order("starts_at"),
    db.from("workshop_choice_settings").select("ranking_open, closes_at, results_published").eq("edition_id", editionId).maybeSingle(),
    db.from("workshop_rankings").select("ranking, updated_at").eq("user_id", userId).eq("edition_id", editionId).maybeSingle(),
    db.from("workshop_allocations").select("slot, workshop_id, choice").eq("user_id", userId).eq("edition_id", editionId).order("slot"),
  ]);

  // Before the set-up runs, the new columns and tables are missing.
  if (ws.error) {
    const { data } = await db.from("workshops").select("id, number, slug, title, strapline, capacity").eq("edition_id", editionId).eq("published", true).order("number");
    return { ...empty, workshops: (data ?? []).map((w) => ({ ...w, slot: null, stream: null }) as ChoiceWorkshop) };
  }
  return {
    editionId,
    workshops: (ws.data ?? []) as ChoiceWorkshop[],
    sessions: (sessions.data ?? []).map((s, i) => {
      const room = (s as { rooms?: { name?: string } | { name?: string }[] | null }).rooms;
      return {
        slot: i + 1,
        title: s.title as string,
        time: s.starts_at ? `${formatTime(s.starts_at as string)}${s.ends_at ? ` to ${formatTime(s.ends_at as string)}` : ""}` : null,
        room: (Array.isArray(room) ? room[0]?.name : room?.name) ?? null,
      };
    }),
    settings: {
      rankingOpen: Boolean(settings.data?.ranking_open),
      closesAt: (settings.data?.closes_at as string | null) ?? null,
      resultsPublished: Boolean(settings.data?.results_published),
      ready: !settings.error,
    },
    ranking: (mine.data?.ranking as string[] | undefined) ?? null,
    rankedAt: (mine.data?.updated_at as string | undefined) ?? null,
    places: (places.data ?? []).map((p) => ({ slot: p.slot as number, workshopId: p.workshop_id as string, choice: (p.choice as number | null) ?? null })),
  };
}
export type WorkshopChoices = Awaited<ReturnType<typeof loadWorkshopChoices>>;
