import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type Storage = Pick<SupabaseClient, "storage">;

/** Profile photos are private; pages show them through links that last an hour. */
export const AVATAR_TTL = 60 * 60;

/**
 * Short-lived links for a set of profile photos, keyed by path. Storage rules
 * decide who may open them, so a viewer who isn't allowed simply gets none.
 */
export async function signAvatars(db: Storage, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (!unique.length) return new Map();
  const { data } = await db.storage.from("avatars").createSignedUrls(unique, AVATAR_TTL);
  const out = new Map<string, string>();
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}

export async function signAvatar(db: Storage, path: string | null | undefined) {
  return path ? ((await signAvatars(db, [path])).get(path) ?? null) : null;
}
