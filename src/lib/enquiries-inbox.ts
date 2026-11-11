import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rolesLabel } from "@/lib/accounts";
import { signAvatars } from "@/lib/avatar";
import type { AccountType } from "@/lib/types";

export type EnquiryPerson = { id: string; name: string; meta: string; roles: string; photo: string | null };

/** Names, roles and photos of the people who wrote in, for the committee. */
export async function enquiryPeople(db: SupabaseClient, ids: string[]): Promise<Map<string, EnquiryPerson>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, EnquiryPerson>();
  if (!unique.length) return out;
  const { data } = await db.rpc("enquiry_people", { p_ids: unique });
  const rows = (data ?? []) as { id: string; full_name: string | null; institution: string | null; year_of_study: string | null; roles: AccountType[]; avatar_path: string | null }[];
  const photos = await signAvatars(db, rows.map((r) => r.avatar_path));
  for (const r of rows)
    out.set(r.id, {
      id: r.id,
      name: r.full_name ?? "Account holder",
      meta: [r.institution, r.year_of_study].filter(Boolean).join(" · "),
      roles: rolesLabel(r.roles),
      photo: r.avatar_path ? (photos.get(r.avatar_path) ?? null) : null,
    });
  return out;
}
