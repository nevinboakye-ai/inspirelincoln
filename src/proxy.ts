import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

const PROTECTED = ["/portal", "/admin", "/review"];

/** Pages that stay reachable while the public website is closed. */
const ALWAYS_OPEN = /^\/(login|signup|auth|portal|admin|review|privacy|cookies|terms|accessibility|contact|api|search-index|opengraph-image|robots\.txt|sitemap\.xml|icon|apple-icon)(\/|$|\.)/;

// The "website open" switch, remembered for a short while so most requests
// don't wait on the database.
let siteOpen: { value: boolean; at: number } | null = null;
const committee = new Map<string, { value: boolean; at: number }>();
const TTL = 20_000;

async function isSiteOpen(url: string, key: string) {
  if (siteOpen && Date.now() - siteOpen.at < TTL) return siteOpen.value;
  let value = true; // If the switch can't be read (e.g. migration not run), stay open.
  try {
    const res = await fetch(`${url}/rest/v1/site_switches?key=eq.site_open&select=enabled`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (res.ok) {
      const rows = (await res.json()) as { enabled: boolean }[];
      if (rows.length) value = rows[0].enabled;
    }
  } catch {}
  siteOpen = { value, at: Date.now() };
  return value;
}

/**
 * Refreshes the Supabase session cookie and redirects signed-out visitors away
 * from account areas. While the public website is closed, visitors are sent to
 * log in and signed-in delegates to My Hub; committee members see everything.
 * This is an optimistic check only: every protected page and server action
 * verifies the user and role again on the server, and row level security
 * enforces access in the database.
 */
export async function proxy(request: NextRequest) {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const gated = !ALWAYS_OPEN.test(path) && !(await isSiteOpen(url, key));
  // Public pages while the site is open need nothing from here.
  if (!isProtected && !gated && !/^\/(login|auth)(\/|$)/.test(path)) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }

  if (gated) {
    let staff = false;
    if (user) {
      const hit = committee.get(user.id);
      if (hit && Date.now() - hit.at < TTL) staff = hit.value;
      else {
        const { data } = await supabase.rpc("has_access", { cap: "edit_website" });
        staff = data === true;
        committee.set(user.id, { value: staff, at: Date.now() });
        if (committee.size > 500) committee.clear();
      }
    }
    if (!staff) {
      const to = request.nextUrl.clone();
      to.pathname = user ? "/portal" : "/login";
      to.search = "";
      return NextResponse.redirect(to);
    }
  }
  return response;
}

export const config = {
  // Everything except Next's own files and static assets.
  matcher: ["/((?!_next/|brand/|images/|favicon|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|txt|xml|webmanifest|woff2?|pdf)$).*)"],
};
