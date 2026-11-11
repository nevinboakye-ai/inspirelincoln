import "server-only";
import { createClient } from "@/lib/supabase/server";
import { BUILT_IN_LOGOS, logoUrl, type LogoMap } from "@/lib/university-logos";

/**
 * Every university logo, keyed by uniKey(name): the built-in ones from the
 * universities' websites, with any the committee has uploaded taking their place.
 */
export async function getLogoMap(): Promise<LogoMap> {
  const db = await createClient();
  if (!db) return { ...BUILT_IN_LOGOS };
  const { data, error } = await db.from("university_logos").select("institution_key, path");
  if (error || !data) return { ...BUILT_IN_LOGOS };
  return { ...BUILT_IN_LOGOS, ...Object.fromEntries(data.map((r) => [r.institution_key, logoUrl(r.path)])) };
}
