import "server-only";
import { serviceClient } from "@/lib/view-as";
import { emailConfigured, sendEmail } from "@/lib/email/resend";
import { confirmEmailMessage, finishSetupMessage, resetPasswordMessage } from "@/lib/email/auth";
import { SITE_URL } from "@/lib/site";

/**
 * Account emails sent by the site itself rather than by Supabase.
 *
 * Supabase's own emails link through its verify endpoint and then redirect to
 * a URL that must be on the project's allow list, using a code that only works
 * in the browser that asked for it. When either isn't true (a phone's mail app
 * opening its own browser, a www/non-www mismatch, a missing redirect URL) the
 * person lands on the homepage with nothing done. Here we ask Supabase for the
 * one-time token directly and email a link to our own /auth/confirm page,
 * which works in any browser and on any device, in the INSPIRE design.
 *
 * Everything falls back to Supabase's own emails when the service key or
 * Resend isn't configured, so nothing breaks in local development.
 */

export const ownAuthEmails = () => Boolean(serviceClient() && emailConfigured());

export function confirmLink(tokenHash: string, type: string, next: string) {
  const q = new URLSearchParams({ token_hash: tokenHash, type, next });
  return `${SITE_URL}/auth/confirm?${q.toString()}`;
}

// A light brake so the form can't be used to flood someone's inbox. Supabase's
// own limits don't apply to links we generate, and this is per server instance.
const recent = new Map<string, number>();
const COOLDOWN = 45_000;
export function tooSoon(key: string) {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < COOLDOWN) return true;
  recent.set(key, now);
  if (recent.size > 2000) for (const [k, t] of recent) if (now - t > COOLDOWN) recent.delete(k);
  return false;
}

const nameOf = (meta: Record<string, unknown> | undefined) => (typeof meta?.full_name === "string" ? meta.full_name : null);

export type SignUpResult =
  | { ok: true }
  | { ok: false; reason: "exists" | "rate" | "send" | "failed"; detail?: string };

/**
 * Creates the account (unconfirmed) and emails a branded confirmation link.
 * If an unconfirmed account already exists for the email, sends a link to
 * finish setting it up instead, so someone whose first link failed can simply
 * try again. The password is never changed for an existing account here: the
 * fresh link lets them choose one after proving they own the inbox.
 */
export async function createAccountAndEmail(o: {
  email: string;
  password: string;
  data: Record<string, unknown>;
  next: string;
  selected?: boolean;
}): Promise<SignUpResult> {
  const admin = serviceClient();
  if (!admin) return { ok: false, reason: "failed", detail: "no service key" };
  if (tooSoon(`signup:${o.email}`)) return { ok: false, reason: "rate" };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: o.email,
    password: o.password,
    options: { data: o.data },
  });

  if (!error && data.properties?.hashed_token) {
    const link = confirmLink(data.properties.hashed_token, data.properties.verification_type ?? "signup", o.next);
    const sent = await sendEmail({ to: o.email, ...confirmEmailMessage({ siteUrl: SITE_URL, link, name: nameOf(o.data), selected: o.selected }) });
    return sent ? { ok: true } : { ok: false, reason: "send" };
  }

  const msg = error?.message.toLowerCase() ?? "";
  if (error && (msg.includes("already") || error.code === "email_exists" || error.code === "user_already_exists")) {
    // Confirmed accounts log in or reset their password; unconfirmed ones get a fresh link.
    const rec = await admin.auth.admin.generateLink({ type: "recovery", email: o.email });
    const user = rec.data?.user;
    if (rec.error || !user || !rec.data.properties?.hashed_token) return { ok: false, reason: "exists" };
    if (user.email_confirmed_at) return { ok: false, reason: "exists" };
    const link = confirmLink(rec.data.properties.hashed_token, "recovery", "/auth/update-password?setup=1");
    const sent = await sendEmail({ to: o.email, ...finishSetupMessage({ siteUrl: SITE_URL, link, name: nameOf(user.user_metadata) }) });
    return sent ? { ok: true } : { ok: false, reason: "send" };
  }
  if (error?.status === 429) return { ok: false, reason: "rate" };
  return { ok: false, reason: "failed", detail: error ? `${error.status} ${error.code} ${error.message}` : "no token" };
}

/** Emails a branded password reset link. Says nothing about whether the account exists. */
export async function emailPasswordReset(email: string): Promise<"sent" | "skipped" | "failed"> {
  const admin = serviceClient();
  if (!admin) return "failed";
  if (tooSoon(`reset:${email}`)) return "skipped";
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  // No account for this address: behave exactly as if we had sent one.
  if (error || !data.properties?.hashed_token) return "skipped";
  const link = confirmLink(data.properties.hashed_token, "recovery", "/auth/update-password");
  const sent = await sendEmail({ to: email, ...resetPasswordMessage({ siteUrl: SITE_URL, link, name: nameOf(data.user?.user_metadata) }) });
  return sent ? "sent" : "failed";
}
