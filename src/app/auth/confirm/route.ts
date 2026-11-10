import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Completes links from INSPIRE's own email templates. Unlike the PKCE code
 * flow, a token hash works when the link opens in a different browser from
 * the one used to sign up, which is common when a phone's mail app opens links.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? (type === "recovery" ? "/auth/update-password" : "/portal?welcome=1");
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/portal";
  if (tokenHash && type && TYPES.includes(type)) {
    const db = await createClient();
    const result = await db?.auth.verifyOtp({ type, token_hash: tokenHash });
    if (result && !result.error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
