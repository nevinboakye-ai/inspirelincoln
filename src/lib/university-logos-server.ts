import "server-only";
import { createClient } from "@/lib/supabase/server";
import { logoUrl, type LogoMap } from "@/lib/university-logos";

/** Every university logo the committee has added, keyed by uniKey(name). */
export async function getLogoMap(): Promise<LogoMap> {
  const db = await createClient();
  if (!db) return {};
  const { data, error } = await db.from("university_logos").select("institution_key, path");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.institution_key, logoUrl(r.path)]));
}
