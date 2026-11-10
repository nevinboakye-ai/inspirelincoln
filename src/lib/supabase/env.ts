/**
 * Normalises the Supabase project URL so common paste mistakes (missing
 * https://, trailing slash or /rest/v1, surrounding spaces) don't break the
 * build. An unusable value is treated as "not configured" so the site still
 * builds and serves its bundled content.
 */
export function normaliseSupabaseUrl(raw: string | undefined): string {
  let v = (raw ?? "").trim().replace(/^["']|["']$/g, "");
  if (!v) return "";
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}`;
  } catch {
    console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL is not a valid URL; Supabase features are disabled.");
    return "";
  }
}

export const SUPABASE_URL = normaliseSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** True when the public Supabase credentials are present. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
