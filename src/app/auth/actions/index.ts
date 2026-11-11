"use server";
import { cookies, headers } from "next/headers";
import { PROFILE_PROMPT_COOKIE, PROFILE_PROMPT_OPTIONS } from "@/lib/profile-prompt";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clearTemporaryPassword } from "@/lib/accounts/login-details";
import { plainClient, serviceClient } from "@/lib/view-as";
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env";
import { SITE_URL } from "@/lib/site";
import { ACCOUNT_TYPES, COMMITTEE_TYPES, POLICY_VERSION, submissionKindFor } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export type AuthState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/portal");

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : SITE_URL;
}

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(10, "Use at least 10 characters.").max(72, "Use 72 characters or fewer.");

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const db = await createClient();
  if (!db) return { error: "Accounts are not available yet." };
  const { data, error } = await db.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("confirm")) return { error: "Please verify your email address first. Check your inbox for the link." };
    return { error: "Email or password is incorrect." };
  }
  // Ask them to finish their profile, if it isn't, once they're in.
  (await cookies()).set(PROFILE_PROMPT_COOKIE, "1", PROFILE_PROMPT_OPTIONS);
  // A temporary password from the committee: choose their own first.
  if (data.user?.app_metadata?.must_change_password === true) redirect("/auth/update-password?first=1");
  redirect(safeNext(form.get("next")));
}

const signUpSchema = z
  .object({
    accountType: z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]], { message: "Choose how you're joining INSPIRE." }),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email,
    password,
    institution: z.string().trim().min(2, "Enter your university or organisation.").max(160),
    careerStage: z.string().trim().min(1, "Choose your stage.").max(80),
    programme: z.string().trim().max(160).optional().default(""),
    committeePosition: z.string().trim().max(120).optional().default(""),
    presentationTitle: z.string().trim().max(300).optional().default(""),
    heardAbout: z.string().trim().max(120).optional().default(""),
    photoOptOut: z.boolean(),
    marketingOptIn: z.boolean(),
    privacyAck: z.literal(true, { message: "Please confirm you have read the privacy notice." }),
  })
  .superRefine((v, ctx) => {
    if (COMMITTEE_TYPES.includes(v.accountType) && v.committeePosition.length < 2)
      ctx.addIssue({ code: "custom", path: ["committeePosition"], message: "Enter your committee position, for example Head of Events." });
    if (submissionKindFor(v.accountType) && v.presentationTitle.length < 5)
      ctx.addIssue({ code: "custom", path: ["presentationTitle"], message: "Enter the title of your presentation." });
  });

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const raw = Object.fromEntries(form);
  const parsed = signUpSchema.safeParse({
    ...raw,
    photoOptOut: form.get("photoOptOut") === "on",
    marketingOptIn: form.get("marketingOptIn") === "on",
    privacyAck: form.get("privacyAck") === "on",
  });
  if (!parsed.success) return { error: "Please check the highlighted answers.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const db = await createClient();
  if (!db) return { error: "Accounts are not available yet." };
  const { data, error } = await db.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      // Only everyday details go in sign-up metadata. Access and dietary needs are added later, with explicit consent.
      data: {
        full_name: v.fullName,
        account_type: v.accountType,
        institution: v.institution,
        career_stage: v.careerStage,
        programme: v.programme,
        committee_position: COMMITTEE_TYPES.includes(v.accountType) ? v.committeePosition : "",
        presentation_title: submissionKindFor(v.accountType) ? v.presentationTitle : "",
        heard_about: v.heardAbout,
        photo_opt_out: v.photoOptOut,
        marketing_opt_in: v.marketingOptIn,
        privacy_ack: true,
        policy_version: POLICY_VERSION,
      },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}`,
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) return { error: "An account with this email already exists. Try signing in." };
    if (error.status === 429) return { error: "Too many attempts. Please wait a minute and try again." };
    // Shows in Vercel's runtime logs so the committee can see the real cause.
    console.error("Sign-up failed:", error.status, error.code, error.message);
    const m = error.message.toLowerCase();
    if (m.includes("sending") || (m.includes("email") && m.includes("confirm")))
      return { error: "We couldn't send your confirmation email. Please try again later, or email inspiresoc@lincolnsu.com." };
    if (m.includes("database"))
      return { error: "We couldn't save your account. Please try again later, or email inspiresoc@lincolnsu.com." };
    return { error: "We couldn't create your account. Please try again, or email inspiresoc@lincolnsu.com." };
  }
  if (data.session) redirect(safeNext(form.get("next")));
  return { message: v.email };
}

/**
 * First log in for someone the committee has already selected. Only an email
 * and password are needed: the database fills in their details from the
 * selected list and approves them. Anyone not on the list gets an account
 * that waits for review, so this never reveals who is on the list.
 */
export async function activateAccount(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password, confirm: z.string(), privacyAck: z.literal(true, { message: "Please confirm you have read the privacy notice." }) })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] })
    .safeParse({ ...Object.fromEntries(form), privacyAck: form.get("privacyAck") === "on" });
  if (!parsed.success) return { error: "Please check the highlighted answers.", fieldErrors: fieldErrors(parsed.error) };
  const db = await createClient();
  if (!db) return { error: "Accounts are not available yet." };
  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { privacy_ack: true, policy_version: POLICY_VERSION, account_type: "delegate" },
      emailRedirectTo: `${await origin()}/auth/callback?next=/portal`,
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) return { error: "You already have an account. Log in, or reset your password if you've forgotten it." };
    if (error.status === 429) return { error: "Too many attempts. Please wait a minute and try again." };
    console.error("Account set-up failed:", error.status, error.code, error.message);
    return { error: "We couldn't set up your account. Please try again later, or email inspiresoc@lincolnsu.com." };
  }
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) return { error: "You already have an account. Log in, or reset your password if you've forgotten it." };
  if (data.session) redirect("/portal");
  return { message: parsed.data.email };
}

export async function requestReset(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const db = await createClient();
  if (!db) return { error: "Accounts are not available yet." };
  await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${await origin()}/auth/callback?next=/auth/update-password` });
  // Same response whether or not the account exists, to avoid revealing who has an account.
  return { message: "If an account exists for that address, we have emailed a link to reset your password." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match.", path: ["confirm"] })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const db = await createClient();
  if (!db) return { error: "Accounts are not available yet." };
  const { data: { user } } = await db.auth.getUser();
  // First log in with a temporary password from the committee.
  const first = user?.app_metadata?.must_change_password === true;
  if (first && form.get("privacyAck") !== "on") return { fieldErrors: { privacyAck: "Please confirm you have read the privacy notice." } };
  if (first && user?.email) {
    // Make sure the temporary password isn't simply kept.
    const probe = plainClient(SUPABASE_ANON_KEY);
    const check = await probe.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (!check.error) {
      await probe.auth.signOut({ scope: "local" });
      return { fieldErrors: { password: "Choose a new password, not the temporary one." } };
    }
  }
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: first ? "We couldn't save your password. Please try again." : "Your reset link may have expired. Please request a new one." };
  if (first && user) {
    await clearTemporaryPassword(user.id);
    await serviceClient()?.from("consent_records").insert({ user_id: user.id, purpose: "privacy_notice", granted: true, policy_version: POLICY_VERSION, source: "portal" });
    await db.auth.refreshSession();
    redirect("/portal?welcome=first");
  }
  redirect("/portal?password=updated");
}

export async function signOut() {
  const db = await createClient();
  await db?.auth.signOut();
  redirect("/");
}
