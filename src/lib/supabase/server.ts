import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";
import { VIEW_AS_COOKIE, openViewAs, readOnlyFetch, type ViewAsPayload } from "@/lib/view-as-seal";

/**
 * Supabase client bound to the signed-in user's cookies. Every query runs
 * under row level security as that user. Use in Server Components, Server
 * Actions and Route Handlers.
 *
 * While the site owner is viewing as someone, this is that person's own
 * session instead (read only), so every page shows exactly what they see.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;
  const view = await getViewAs();
  if (view) {
    if ((await headers()).get("next-action")) {
      // A form was submitted while viewing as someone. Nothing is saved.
      const back = (await headers()).get("referer");
      let path = "/portal";
      try {
        if (back) path = new URL(back).pathname;
      } catch {}
      redirect(`${path}?viewas=readonly`);
    }
    return view.db;
  }
  return createSessionClient();
}

/** The signed-in person's own client, ignoring any "view as". */
export async function createSessionClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Anonymous client for public content. It does not read cookies, so pages
 * that use it can be statically generated and revalidated.
 */
export function createPublicClient() {
  if (!isSupabaseConfigured) return null;
  return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The active "view as", checked on every request: the cookie must be genuine,
 * it must belong to the person signed in, and they must still be site owner.
 */
type ViewClient = NonNullable<Awaited<ReturnType<typeof createSessionClient>>>;

export const getViewAs = cache(async (): Promise<{ payload: ViewAsPayload; db: ViewClient } | null> => {
  const store = await cookies();
  const payload = openViewAs(store.get(VIEW_AS_COOKIE)?.value);
  if (!payload) return null;
  const real = await createSessionClient();
  if (!real) return null;
  const {
    data: { user },
  } = await real.auth.getUser();
  if (!user || user.id !== payload.o) return null;
  const { data: me } = await real.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") return null;
  const db = createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: readOnlyFetch },
  });
  const { error } = await db.auth.setSession({ access_token: payload.a, refresh_token: payload.r });
  if (error) return null;
  return { payload, db: db as unknown as ViewClient };
});
