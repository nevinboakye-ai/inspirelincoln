import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadWorkshopChoices } from "@/lib/workshops/choices";
import type { AllocSummary } from "@/lib/workshops/allocate";

export type ChoicePerson = {
  id: string;
  name: string;
  email: string;
  institution: string | null;
  committee: boolean;
  ranking: string[] | null;
  rankedAt: string | null;
};
export type BoardPlace = { userId: string; slot: number; workshopId: string; choice: number | null; manual: boolean };

/** Everything the committee's workshop places page needs. */
export async function loadAllocationBoard(db: SupabaseClient, userId: string) {
  const base = await loadWorkshopChoices(db, userId);
  const [people, places, run] = await Promise.all([
    db.rpc("workshop_choice_people"),
    db.from("workshop_allocations").select("user_id, slot, workshop_id, choice, manual").eq("edition_id", base.editionId ?? ""),
    db.from("workshop_allocation_runs").select("ran_at, summary, ran_by, profiles(full_name)").eq("edition_id", base.editionId ?? "").order("ran_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const ids = new Set(base.workshops.map((w) => w.id));
  return {
    ...base,
    people: ((people.data ?? []) as { user_id: string; full_name: string | null; email: string; institution: string | null; committee: boolean; ranking: string[] | null; ranked_at: string | null }[]).map(
      (p): ChoicePerson => ({
        id: p.user_id,
        name: p.full_name || p.email,
        email: p.email,
        institution: p.institution,
        committee: p.committee,
        // A ranking made before a workshop was added or removed is ignored.
        ranking: p.ranking && p.ranking.length === ids.size && p.ranking.every((x) => ids.has(x)) ? p.ranking : null,
        rankedAt: p.ranked_at,
      }),
    ),
    allPlaces: ((places.data ?? []) as { user_id: string; slot: number; workshop_id: string; choice: number | null; manual: boolean }[]).map(
      (p): BoardPlace => ({ userId: p.user_id, slot: p.slot, workshopId: p.workshop_id, choice: p.choice, manual: p.manual }),
    ),
    lastRun: run.data
      ? {
          at: run.data.ran_at as string,
          by: ((run.data as { profiles?: { full_name?: string } | null }).profiles?.full_name as string | undefined) ?? null,
          summary: run.data.summary as AllocSummary,
        }
      : null,
    peopleError: people.error?.message ?? null,
  };
}
export type AllocationBoard = Awaited<ReturnType<typeof loadAllocationBoard>>;
