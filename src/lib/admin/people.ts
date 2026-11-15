import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns of public.staff_people, the narrow list of people for dashboard pages. */
export const STAFF_PEOPLE_COLUMNS =
  "id, email, full_name, institution, year_of_study, account_type, extra_types, account_status, role, presentation_title, committee_position, created_at";

type Query = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

/**
 * Reads people for pages like presenter attendance, travel and the audit log.
 * Uses public.staff_people (setup file 41), which only has the columns those
 * pages need, so someone allowed one of those areas never sees whole profiles
 * with access and dietary needs. Before setup file 41 runs, falls back to
 * profiles, which only the people who could open those pages then could read.
 */
export async function selectPeople<T = Record<string, unknown>>(
  db: SupabaseClient,
  columns: string,
  refine: (q: Query) => Query = (q) => q,
): Promise<T[]> {
  const viaView = await refine(db.from("staff_people").select(columns));
  if (!viaView.error) return (viaView.data ?? []) as T[];
  const viaProfiles = await refine(db.from("profiles").select(columns));
  return (viaProfiles.data ?? []) as T[];
}
