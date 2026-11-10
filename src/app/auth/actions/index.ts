"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

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

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Enter your name.").max(120),
      email,
      password,
      consent: z.literal("on", { message: "Please confirm you have read the privacy policy." }),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const db = await createClient();
  if (!db) return { error: "Accounts are not available yet." };
  const { data, error } = await db.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}`,
    },
  });
  if (error) return { error: error.message.includes("already") ? "An account with this email already exists. Try signing in." : "We couldn't create your account. Please try again." };
  if (data.session) redirect(safeNext(form.get("next")));
  return { message: "Check your inbox: we have sent a link to verify your email address. Your account is ready once it is verified." };
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
