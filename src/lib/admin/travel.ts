import type { SupabaseClient } from "@supabase/supabase-js";
import { isTravelMode, type TravelMode } from "@/lib/travel";

export type TravelRow = {
  id: string;
  name: string;
  email: string;
  institution: string | null;
  mode: TravelMode | null;
  carRegistration: string | null;
  updatedAt: string | null;
};

/**
 * Every approved account with how they said they're travelling (or null
 * when they haven't answered yet). Needs review_accounts or manage_people.
 */
export async function loadTravel(db: SupabaseClient) {
  const [{ data: profiles }, { data: answers, error }] = await Promise.all([
    db.from("profiles").select("id, full_name, email, institution").eq("account_status", "approved").limit(5000),
    db.from("delegate_travel").select("user_id, mode, car_registration, updated_at").limit(5000),
  ]);
  const byUser = new Map((answers ?? []).map((a) => [a.user_id as string, a]));
  const rows: TravelRow[] = (profiles ?? []).map((p) => {
    const a = byUser.get(p.id);
    const mode = a && isTravelMode(a.mode) ? a.mode : null;
    return {
      id: p.id,
      name: p.full_name || p.email,
      email: p.email,
      institution: p.institution,
      mode,
      carRegistration: mode === "car" ? (a?.car_registration ?? null) : null,
      updatedAt: a?.updated_at ?? null,
    };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  // Before setup SQL 36 there's no table to read from.
  return { rows, ready: !error };
}
