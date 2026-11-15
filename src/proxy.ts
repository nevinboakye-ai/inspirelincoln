import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { VIEW_AS_COOKIE, openViewAs } from "@/lib/view-as-seal";
import { strayAuthTarget } from "@/lib/accounts/link-paths";

const PROTECTED = ["/portal", "/admin", "/review", "/judge"];

/** Pages that stay reachable while the public website is closed. */
const ALWAYS_OPEN = /^\/(m|login|signup|auth|portal|admin|review|judge|view-as|privacy|cookies|terms|accessibility|contact|api|search-index|opengraph-image|robots\.txt|sitemap\.xml|icon|apple-icon)(\/|$|\.)/;

// The "website open" switch, remembered for a short while so most requests
// don't wait on the database.
let siteOpen: { value: boolean; at: number } | null = null;
const committee = new Map<string, { value: boolean; at: number }>();
const TTL = 20_000;

/** The sign-in cookies (one cookie, or several chunks of one: sb-<ref>-auth-token.0, .1, ...). */
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;
/**
 * Set by the server each time it re-issues the sign-in cookies. Safari keeps a
 * cookie written by the page's own JavaScript for at most 7 days, so a session
 * the browser refreshed itself would vanish after a week away; a cookie the
 * server sends lasts the full 400 days. Re-sending once a day keeps it that way.
 */
const KEPT_COOKIE = "il-session-kept";
const KEEP_EVERY = 24 * 60 * 60 * 1000;
const COOKIE_LIFETIME = 400 * 24 * 60 * 60; // the longest browsers allow

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
  // An account link that landed on the wrong page: send it where it belongs.
  if (request.nextUrl.search) {
    const target = strayAuthTarget(path, request.nextUrl.searchParams);
    if (target) return NextResponse.redirect(new URL(target, request.url));
  }
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const gated = !ALWAYS_OPEN.test(path) && !(await isSiteOpen(url, key));
  // Public pages while the site is open need nothing from here.
  const signedIn = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name) && c.value);
  // Guests on public pages need nothing from here. Anyone signed in always goes
  // through, so their session is refreshed wherever they are on the site: a
  // page that refreshes it itself can't save the new cookies, and Supabase then
  // ends the whole session when the old refresh token is used again.
  if (!signedIn && !isProtected && !gated && !/^\/(login|auth|m)(\/|$)/.test(path)) return response;

  // Cookies the refresh wrote, so a redirect carries them too (a redirect that
  // drops them leaves the browser holding a spent refresh token).
  let written: { name: string; value: string; options: Parameters<typeof response.cookies.set>[2] }[] = [];
  let noStore: Record<string, string> = {};
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        written = cookiesToSet;
        noStore = headers ?? {};
      },
    },
  });
  const redirect = (to: URL) => {
    const r = NextResponse.redirect(to);
    written.forEach(({ name, value, options }) => r.cookies.set(name, value, options));
    Object.entries(noStore).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  };

  let user: { id: string; app_metadata: Record<string, unknown> } | null = null;
  if (isProtected || gated) {
    // getClaims refreshes an expired session (writing the new cookies) and then
    // verifies the access token's signature locally against the project's cached
    // public keys, so most navigations don't wait on the auth server at all.
    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    user = claims?.sub ? { id: claims.sub, app_metadata: (claims.app_metadata ?? {}) as Record<string, unknown> } : null;
  } else {
    // Only keep the session fresh here: it reads the cookies and talks to the
    // auth server only when the access token has run out. Pages that need to
    // know who someone is check that themselves.
    await supabase.auth.getSession();
  }

  // Re-send the sign-in cookies from the server once a day so the browser
  // keeps them for the full lifetime (see KEPT_COOKIE).
  if (!written.length && signedIn) {
    const last = Number(request.cookies.get(KEPT_COOKIE)?.value);
    if (!(Date.now() - last < KEEP_EVERY)) {
      const options = { path: "/", sameSite: "lax" as const, httpOnly: false, secure: request.nextUrl.protocol === "https:", maxAge: COOKIE_LIFETIME };
      written = request.cookies
        .getAll()
        .filter((c) => AUTH_COOKIE.test(c.name) && c.value)
        .map(({ name, value }) => ({ name, value, options }));
      written.push({ name: KEPT_COOKIE, value: String(Date.now()), options: { ...options, httpOnly: true } });
      noStore = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" };
      written.forEach(({ name, value, options: o }) => response.cookies.set(name, value, o));
      Object.entries(noStore).forEach(([k, v]) => response.headers.set(k, v));
    }
  }

  // Someone given a temporary password chooses their own before anything else.
  if (user?.app_metadata?.must_change_password === true && isProtected) {
    const to = request.nextUrl.clone();
    to.pathname = "/auth/update-password";
    to.search = "?first=1";
    return redirect(to);
  }

  if (!user && isProtected) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return redirect(login);
  }

  if (gated) {
    let staff = false;
    // While the site owner is viewing as someone, gate the site as that person would see it.
    const view = user ? openViewAs(request.cookies.get(VIEW_AS_COOKIE)?.value) : null;
    const viewing = view && view.o === user?.id ? view : null;
    const who = viewing ? viewing.t : user?.id;
    if (who) {
      const hit = committee.get(who);
      if (hit && Date.now() - hit.at < TTL) staff = hit.value;
      else {
        if (viewing) {
          const res = await fetch(`${url}/rest/v1/rpc/is_editor`, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${viewing.a}`, "Content-Type": "application/json" },
            body: "{}",
            cache: "no-store",
          }).catch(() => null);
          staff = res?.ok ? (await res.json()) === true : false;
        } else {
          // Anyone who can edit some part of the website (public.is_editor).
          const { data } = await supabase.rpc("is_editor");
          staff = data === true;
        }
        committee.set(who, { value: staff, at: Date.now() });
        if (committee.size > 500) committee.clear();
      }
    }
    if (!staff) {
      const to = request.nextUrl.clone();
      to.pathname = user ? "/portal" : "/login";
      to.search = "";
      return redirect(to);
    }
  }
  return response;
}

export const config = {
  // Everything except Next's own files and static assets.
  matcher: ["/((?!_next/|brand/|images/|favicon|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|txt|xml|webmanifest|woff2?|pdf)$).*)"],
};
