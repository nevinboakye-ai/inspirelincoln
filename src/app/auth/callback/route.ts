import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { PROFILE_PROMPT_COOKIE, PROFILE_PROMPT_OPTIONS } from "@/lib/profile-prompt";
import { failedLinkPath, safeLinkNext } from "@/lib/accounts/link-paths";

/**
 * Completes links from Supabase's own emails (PKCE code exchange). The site
 * now sends its own account emails to /auth/confirm, but older emails and the
 * fallback when Resend isn't configured still come here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeLinkNext(searchParams.get("next"));
  // Links that carry a token hash belong to the confirm page.
  const tokenHash = searchParams.get("token_hash");
  if (tokenHash) return NextResponse.redirect(`${origin}/auth/confirm?${searchParams.toString()}`);

  const db = await createSessionClient();
  if (code && db) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.set(PROFILE_PROMPT_COOKIE, "1", PROFILE_PROMPT_OPTIONS);
      return res;
    }
    // Usually the link was opened in a different browser from the one that asked for it.
    console.error("Auth callback failed:", error.status, error.code, error.message);
  } else if (searchParams.get("error")) {
    console.error("Auth callback error:", searchParams.get("error_code"), searchParams.get("error_description"));
  }
  // Already signed in (a second tap, or the session was set some other way): carry on.
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (user) return NextResponse.redirect(`${origin}${next}`);
  return NextResponse.redirect(`${origin}${failedLinkPath(next.startsWith("/auth/update-password") ? "recovery" : "signup", next)}`);
}
