import type { EmailOtpType } from "@supabase/supabase-js";

/** The kinds of emailed link /auth/confirm accepts. */
export const LINK_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Where a link goes once it has worked: only paths on this site. */
export function safeLinkNext(next: string | null | undefined, type?: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return type === "recovery" ? "/auth/update-password" : "/portal?welcome=1";
}

/** Where to send someone whose link has expired or was already used, so they can get a fresh one. */
export function failedLinkPath(type: string | null | undefined, next = "") {
  if (next.includes("setup=1")) return "/auth/activate?error=expired";
  if (type === "recovery" || next.startsWith("/auth/update-password")) return "/auth/reset?error=expired";
  return "/login?error=link";
}

/** What the confirm page says and the button reads, for each kind of link. */
export function linkCopy(type: string | null | undefined, next = "") {
  if (type === "recovery" && next.includes("setup=1"))
    return { title: "Finish setting up your account", intro: "Tap continue to confirm your email, then choose your password.", button: "Continue" };
  if (type === "recovery") return { title: "Reset your password", intro: "Tap continue, then choose a new password.", button: "Continue" };
  if (type === "invite") return { title: "Accept your invitation", intro: "Tap continue to set up your INSPIRE account.", button: "Continue" };
  if (type === "magiclink") return { title: "Log in to My Hub", intro: "Tap continue to log in to your INSPIRE account.", button: "Log in" };
  if (type === "email_change") return { title: "Confirm your new email", intro: "Tap below to confirm the new email address for your account.", button: "Confirm new email" };
  return { title: "Confirm your email", intro: "One more tap and you're in. We'll take you straight to My Hub.", button: "Confirm my email" };
}

/**
 * When an account link lands on the wrong page (usually the homepage, because
 * Supabase fell back to its Site URL), where it should have gone. Returns
 * null for ordinary visits.
 */
export function strayAuthTarget(pathname: string, params: URLSearchParams): string | null {
  if (/^\/(auth|api)(\/|$)/.test(pathname)) return null;
  if (params.get("token_hash") && params.get("type")) return `/auth/confirm?${params.toString()}`;
  if (params.get("error_code") || (params.get("error") && params.get("error_description"))) return "/login?error=link";
  // Only where Supabase would send it: "code" may mean something else elsewhere.
  const code = params.get("code");
  if (code && (pathname === "/" || pathname === "/login" || pathname === "/portal")) {
    const next = safeLinkNext(params.get("next"));
    return `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
  }
  return null;
}
