import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConferenceBundle, getMapPlaces } from "@/lib/data/content";
import { buildDay, type AssignmentRole, type DayAssignment, type DayItem, type DayMark, type DayPlace, type DayWorkshop } from "@/lib/day/plan";

export type DayContext = Awaited<ReturnType<typeof dayContext>>;

/** The public parts of everyone's day: the programme, rooms, workshops and map. Cached with the public pages. */
export async function dayContext() {
  const [{ edition, sessions, rooms, workshops }, mapPlaces] = await Promise.all([getConferenceBundle(), getMapPlaces()]);
  const ws: DayWorkshop[] = workshops.map((w) => ({ id: w.id, number: w.number, title: w.title, slug: w.slug, room: w.room ?? null }));
  return { edition, sessions, rooms, workshops: ws, mapPlaces };
}

const isRole = (r: unknown): r is AssignmentRole => typeof r === "string" && ["attending", "presenting", "judging", "chairing", "helping"].includes(r);

/**
 * The signed-in person's own day. Workshop places only count once the
 * committee publishes them (row level security hides them until then).
 * Before setup SQL 42 runs, the new tables are missing and the day is just
 * the programme with workshop places.
 */
export async function loadMyDay(db: SupabaseClient, userId: string) {
  const ctx = await dayContext();
  const editionId = ctx.edition.id;
  const [settings, places, assignments, marks] = await Promise.all([
    db.from("workshop_choice_settings").select("results_published").eq("edition_id", editionId).maybeSingle(),
    db.from("workshop_allocations").select("slot, workshop_id, choice").eq("edition_id", editionId).eq("user_id", userId),
    db.from("programme_assignments").select("session_id, role, note").eq("edition_id", editionId).eq("user_id", userId),
    db.from("workshop_attendance").select("slot, workshop_id, marked_at").eq("edition_id", editionId).eq("user_id", userId),
  ]);
  const published = Boolean(settings.data?.results_published);
  const day = buildDay({
    ...ctx,
    places: published ? ((places.data ?? []) as { slot: number; workshop_id: string; choice: number | null }[]).map((p): DayPlace => ({ slot: p.slot, workshopId: p.workshop_id, choice: p.choice })) : [],
    placesPublished: published,
    assignments: ((assignments.data ?? []) as { session_id: string; role: string; note: string | null }[]).flatMap((a): DayAssignment[] =>
      isRole(a.role) ? [{ sessionId: a.session_id, role: a.role, note: a.note }] : [],
    ),
    marks: ((marks.data ?? []) as { slot: number; workshop_id: string; marked_at: string }[]).map((m): DayMark => ({ slot: m.slot, workshopId: m.workshop_id, markedAt: m.marked_at })),
  });
  return { items: day, placesPublished: published, edition: ctx.edition };
}

/** What public.day_person returns, for the scanner. */
export type DayPersonRow = {
  id: string;
  full_name: string | null;
  institution: string | null;
  year_of_study: string | null;
  avatar_path: string | null;
  committee_position: string | null;
  roles: string[];
  accessibility_needs: string | null;
  places: { slot: number; workshop_id: string }[];
  assignments: { session_id: string; role: string; note: string | null }[];
  marks: { slot: number; workshop_id: string; marked_at: string; marked_by: string | null }[];
  account_status: string;
  registration: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
};

/** Someone else's day, as the committee sees it at the door: places count whether or not they're published. */
export function personDay(ctx: DayContext, p: DayPersonRow): DayItem[] {
  return buildDay({
    ...ctx,
    places: (p.places ?? []).map((x) => ({ slot: x.slot, workshopId: x.workshop_id })),
    placesPublished: true,
    assignments: (p.assignments ?? []).flatMap((a): DayAssignment[] => (isRole(a.role) ? [{ sessionId: a.session_id, role: a.role, note: a.note }] : [])),
    marks: (p.marks ?? []).map((m) => ({ slot: m.slot, workshopId: m.workshop_id, markedAt: m.marked_at, markedBy: m.marked_by })),
  });
}
