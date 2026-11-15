"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";
import { PROFILE_PROMPT_COOKIE, PROFILE_PROMPT_OPTIONS } from "@/lib/profile-prompt";
import { LINK_TYPES, failedLinkPath, safeLinkNext } from "@/lib/accounts/link-paths";

/**
 * Uses the one-time token from an emailed link. This runs when the person taps
 * the button on /auth/confirm, never on the GET itself, so email security
 * scanners that open every link (common on university Outlook accounts) can't
 * use the token up before the person gets there.
 */
export async function completeEmailLink(form: FormData) {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  const next = safeLinkNext(String(form.get("next") ?? ""), type);
  const db = await createSessionClient();
  if (!db || !tokenHash || !LINK_TYPES.includes(type)) redirect(failedLinkPath(type, next));

  const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error("Email link failed:", type, error.status, error.code, error.message);
    // Already used, but they're signed in anyway (for example a second tap): carry on.
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect(failedLinkPath(type, next));
  }
  (await cookies()).set(PROFILE_PROMPT_COOKIE, "1", PROFILE_PROMPT_OPTIONS);
  redirect(next);
}
