"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.message.toLowerCase().includes("confirm")) return { error: "Please verify your email address first. Check your inbox for the link." };
    return { error: "Email or password is incorrect." };
  }
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
    return { error: "We couldn't create your account. Please try again." };
  }
  if (data.session) redirect(safeNext(form.get("next")));
  return { message: v.email };
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
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Your reset link may have expired. Please request a new one." };
  redirect("/portal?password=updated");
}

export async function signOut() {
  const db = await createClient();
  await db?.auth.signOut();
  redirect("/");
}
