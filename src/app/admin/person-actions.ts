"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
import type { ActionResult } from "@/app/portal/actions";

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).optional().default("");
const emailField = z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i, "Enter a valid email address.");

function errors(e: z.ZodError) {
  const fe: Record<string, string> = {};
  for (const i of e.issues) fe[String(i.path[0])] ??= i.message;
  return fe;
}

const personSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(2, "Enter their name.").max(120),
  email: emailField,
  institution: text(160),
  programme: text(160),
  yearOfStudy: text(40),
  careerStage: text(80),
  committeePosition: text(120),
  presentationTitle: text(300),
});

/** The committee correcting someone's details. Only the site owner can change the email they log in with. */
export async function updatePerson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, profile } = await requireAccess("review_accounts", "/admin/accounts");
  const parsed = personSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: errors(parsed.error) };
  const v = parsed.data;

  const { data: current } = await db.from("profiles").select("email, role").eq("id", v.id).maybeSingle();
  if (!current) return { ok: false, error: "This account no longer exists." };
  if (current.role === "admin" && !profile.access.owner) return { ok: false, error: "Only the site owner can change the site owner's account." };

  const emailChanged = v.email !== current.email.toLowerCase();
  if (emailChanged && !profile.access.owner) return { ok: false, fieldErrors: { email: "Only the site owner can change the email someone logs in with." } };

  const { error } = await db
    .from("profiles")
    .update({
      full_name: v.fullName,
      institution: v.institution || null,
      programme: v.programme || null,
      year_of_study: v.yearOfStudy || null,
      career_stage: v.careerStage || null,
      committee_position: v.committeePosition || null,
      presentation_title: v.presentationTitle || null,
    })
    .eq("id", v.id);
  if (error) return { ok: false, error: "Could not save their details." };

  if (emailChanged) {
    const { error: e } = await db.rpc("change_account_email", { target: v.id, new_email: v.email });
    if (e) {
      const msg = e.message.includes("already in use") ? "Another account already uses this email." : "Their details were saved, but the email couldn't be changed.";
      return { ok: false, fieldErrors: { email: msg }, error: msg };
    }
  }
  revalidatePath(`/admin/accounts/${v.id}`);
  revalidatePath("/admin/accounts");
  return { ok: true, message: emailChanged ? "Saved. They now log in with the new email." : "Saved." };
}

const ROSTER_TYPES = ["delegate", "oral_presenter", "poster_presenter"] as const;

const rosterSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(2, "Enter their name.").max(120),
  email: emailField,
  institution: text(160),
  yearOfStudy: text(40),
  accountType: z.enum(ROSTER_TYPES),
  presentationTitle: text(300),
  note: text(1000),
});

/** Correct someone on the selected list, including the email they'll set up their account with. */
export async function updateRosterPerson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireAccess("review_accounts", "/admin/accounts/roster");
  const parsed = rosterSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: errors(parsed.error) };
  const v = parsed.data;

  const { data: current } = await db.from("delegate_roster").select("email").eq("id", v.id).maybeSingle();
  if (!current) return { ok: false, error: "This person is no longer on the list." };
  if (v.email !== current.email) {
    const { data: clash } = await db.from("delegate_roster").select("id").eq("email", v.email).maybeSingle();
    if (clash) return { ok: false, fieldErrors: { email: "Someone else on the list already uses this email." } };
  }
  const { error } = await db
    .from("delegate_roster")
    .update({
      email: v.email,
      full_name: v.fullName,
      institution: v.institution || null,
      year_of_study: v.yearOfStudy || null,
      account_type: v.accountType,
      presentation_title: v.presentationTitle || null,
      note: v.note || null,
    })
    .eq("id", v.id);
  if (error) return { ok: false, error: "Could not save their details." };
  revalidatePath(`/admin/accounts/selected/${v.id}`);
  revalidatePath("/admin/accounts/roster");
  return { ok: true, message: v.email !== current.email ? "Saved. They can now set up their account with the new email." : "Saved." };
}

/** Take someone off the selected list. An account they have already set up is not changed. */
export async function removeRosterPerson(form: FormData) {
  const { db } = await requireAccess("review_accounts", "/admin/accounts/roster");
  await db.from("delegate_roster").delete().eq("id", String(form.get("id")));
  revalidatePath("/admin/accounts/roster");
  redirect("/admin/accounts/roster?removed=1");
}
