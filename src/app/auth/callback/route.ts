import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_PROMPT_COOKIE, PROFILE_PROMPT_OPTIONS } from "@/lib/profile-prompt";

/** Completes email verification, magic links and password recovery (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/portal";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/portal";
  if (code) {
    const db = await createClient();
    const { error } = (await db?.auth.exchangeCodeForSession(code)) ?? { error: true };
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.set(PROFILE_PROMPT_COOKIE, "1", PROFILE_PROMPT_OPTIONS);
      return res;
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
