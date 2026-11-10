import "server-only";
import { cookies } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { VIEW_AS_COOKIE, VIEW_AS_WHO_COOKIE, openViewAs, type ViewAsPayload } from "@/lib/view-as-seal";

const plain = (key: string) => createPlainClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

export const serviceClient = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? plain(key) : null;
};

export async function logViewAs(action: "view_as_start" | "view_as_end", ownerId: string, targetId: string, name: string) {
  await serviceClient()?.from("audit_events").insert({ actor_id: ownerId, action, entity: "view_as", entity_id: targetId, details: { name } });
}

/** Ends the borrowed session so it can't be used again, and clears the cookies. */
export async function endViewAs(): Promise<ViewAsPayload | null> {
  const store = await cookies();
  const p = openViewAs(store.get(VIEW_AS_COOKIE)?.value);
  if (p) {
    const c = plain(SUPABASE_ANON_KEY);
    const { error } = await c.auth.setSession({ access_token: p.a, refresh_token: p.r });
    if (!error) await c.auth.signOut({ scope: "local" });
  }
  store.delete(VIEW_AS_COOKIE);
  store.delete(VIEW_AS_WHO_COOKIE);
  return p;
}

export { plain as plainClient };
