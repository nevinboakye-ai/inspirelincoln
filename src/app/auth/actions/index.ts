1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
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
import { createAccountAndEmail, emailPasswordReset, ownAuthEmails } from "@/lib/accounts/auth-links";
import { ACCOUNT_TYPES, COMMITTEE_TYPES, GUEST_TYPES, POLICY_VERSION, submissionKindFor } from "@/lib/accounts";
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

function ownEmailError(r: Extract<Awaited<ReturnType<typeof createAccountAndEmail>>, { ok: false }>, flow: "register" | "activate") {
  if (r.reason === "exists")
    return flow === "activate"
      ? "You already have an account. Log in, or reset your password if you've forgotten it."
      : "An account with this email already exists. Try logging in, or reset your password.";
  if (r.reason === "rate") return "We've just sent you an email. Please wait a minute before trying again, and check your junk folder.";
  if (r.reason === "send") return "We couldn't send your email just now. Please try again in a minute, or email inspiresoc@lincolnsu.com.";
  console.error("Account email failed:", r.detail);
  return "We couldn't set up your account. Please try again later, or email inspiresoc@lincolnsu.com.";
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