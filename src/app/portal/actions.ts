"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { requireUser } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { abstractSchema, FILE_RULES } from "@/lib/validation/abstract";
import { POLICY_VERSION, resolveFileType, SUBMISSION_FILES, submissionKindFor } from "@/lib/accounts";
import { sendEmail } from "@/lib/email/resend";
import { submissionReceivedEmail } from "@/lib/email/messages";
import { SITE_URL } from "@/lib/site";

export type ActionResult = { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; id?: string } | null;

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/* ---------- Profile ---------- */
const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  institution: z.string().trim().max(160).optional().default(""),
  programme: z.string().trim().max(160).optional().default(""),
  careerStage: z.string().trim().max(80).optional().default(""),
  committeePosition: z.string().trim().max(120).optional().default(""),
  presentationTitle: z.string().trim().max(300).optional().default(""),
});

export async function updateProfile(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/profile");
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const { error } = await db
    .from("profiles")
    .update({
      full_name: v.fullName,
      institution: v.institution || null,
      programme: v.programme || null,
      career_stage: v.careerStage || null,
      committee_position: v.committeePosition || null,
      presentation_title: v.presentationTitle || null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "We couldn't save your details." };
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Saved." };
}

/**
 * Access and dietary needs can reveal health or religious beliefs, which UK
 * GDPR treats as special category data. They are only stored with explicit
 * consent, recorded first, and are wiped if consent is withdrawn.
 */
export async function saveNeeds(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/profile");
  const accessibility = String(form.get("accessibility") ?? "").trim().slice(0, 1000);
  const dietary = String(form.get("dietary") ?? "").trim().slice(0, 500);
  if (form.get("intent") === "remove") {
    const { error } = await db.from("consent_records").insert({ user_id: user.id, purpose: "special_category", granted: false, policy_version: POLICY_VERSION, source: "portal" });
    if (error) return { ok: false, error: "We couldn't remove your details. Please try again." };
    revalidatePath("/portal", "layout");
    return { ok: true, message: "Removed. We no longer hold any access or dietary details for you." };
  }
  if (!accessibility && !dietary) return { ok: false, error: "Add your access or dietary needs, or leave this section empty." };
  if (form.get("consent") !== "on") return { ok: false, fieldErrors: { consent: "Please tick the box to give your permission, or leave these details out." } };
  const c = await db.from("consent_records").insert({ user_id: user.id, purpose: "special_category", granted: true, policy_version: POLICY_VERSION, source: "portal" });
  if (c.error) return { ok: false, error: "We couldn't save your details. Please try again." };
  const { error } = await db.from("profiles").update({ accessibility_needs: accessibility || null, dietary_requirements: dietary || null }).eq("id", user.id);
  if (error) return { ok: false, error: "We couldn't save your details. Please try again." };
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Saved. Only the executive committee can see these details." };
}

/** Marketing email and photography preferences, each change kept in the consent history. */
export async function setPreference(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/profile");
  const purpose = form.get("purpose");
  if (purpose !== "marketing_email" && purpose !== "photography_opt_out") return { ok: false, error: "Unknown preference." };
  const granted = form.get("value") === "on";
  const { error } = await db.from("consent_records").insert({ user_id: user.id, purpose, granted, policy_version: POLICY_VERSION, source: "portal" });
  if (error) return { ok: false, error: "We couldn't save that. Please try again." };
  revalidatePath("/portal/profile");
  return { ok: true, message: "Preference saved." };
}

/** Permanently deletes the account and everything linked to it. */
export async function deleteAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/profile");
  if (form.get("confirm") !== "DELETE") return { ok: false, fieldErrors: { confirm: "Type DELETE to confirm." } };
  // Remove uploaded files first; the database rows go with the account.
  for (const bucket of ["submissions", "posters", "abstracts"]) {
    const folders = bucket === "submissions" ? [`${user.id}/slides`, `${user.id}/poster`] : [user.id];
    for (const folder of folders) {
      const { data } = await db.storage.from(bucket).list(folder, { limit: 1000 });
      const paths = (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
      if (paths.length) await db.storage.from(bucket).remove(paths);
    }
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { error } = key
    ? await createAdminClient(SUPABASE_URL, key, { auth: { persistSession: false } }).auth.admin.deleteUser(user.id)
    : await db.rpc("delete_my_account");
  if (error) return { ok: false, error: "We couldn't delete your account. Please contact the committee and we'll do it for you." };
  await db.auth.signOut();
  redirect("/?account=deleted");
}

/* ---------- Abstracts ---------- */
function readAbstractForm(form: FormData) {
  const raw = Object.fromEntries(form);
  return {
    ...raw,
    consentData: form.get("consentData") === "on",
    declarationOriginal: form.get("declarationOriginal") === "on",
    consentShowcase: form.get("consentShowcase") === "on",
  };
}

export async function saveAbstract(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/abstracts/new");
  const edition = await getEdition();
  const cfg = edition.abstractConfig;
  const intent = form.get("intent") === "submit" ? "submit" : "draft";
  const id = (form.get("id") as string) || null;

  if (!id && !cfg.submissionsOpen) return { ok: false, error: "Abstract submissions are closed." };
  const parsed = abstractSchema(cfg, intent).safeParse(readAbstractForm(form));
  if (!parsed.success) return { ok: false, error: intent === "submit" ? "Please complete the highlighted fields before submitting." : "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  let filePath: string | null | undefined = undefined;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (!cfg.allowFiles) return { ok: false, error: "Supporting files are not accepted for this cycle." };
    if (!FILE_RULES.abstract.types.includes(file.type)) return { ok: false, fieldErrors: { file: "Upload a PDF file." } };
    if (file.size > cfg.maxFileMb * 1024 * 1024) return { ok: false, fieldErrors: { file: `Files must be ${cfg.maxFileMb} MB or smaller.` } };
    filePath = `${user.id}/${crypto.randomUUID()}.pdf`;
    const up = await db.storage.from("abstracts").upload(filePath, file, { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: "The file could not be uploaded. Please try again." };
  }

  const row = {
    presenting_author: v.presentingAuthor,
    email: v.email,
    university: v.university,
    programme_year: v.programmeYear,
    title: v.title,
    co_authors: v.coAuthors,
    category: v.category,
    presentation_preference: v.presentationPreference || null,
    background: v.background,
    aim: v.aim,
    methods: v.methods,
    results: v.results,
    conclusion: v.conclusion,
    consent_data: v.consentData,
    declaration_original: v.declarationOriginal,
    consent_showcase: v.consentShowcase,
    status: intent === "submit" ? "submitted" : "draft",
    ...(filePath !== undefined ? { file_path: filePath } : {}),
  };

  if (id) {
    const { error } = await db.from("abstracts").update(row).eq("id", id).eq("submitter_id", user.id).eq("status", "draft");
    if (error) return { ok: false, error: "This abstract can no longer be edited." };
    revalidatePath("/portal", "layout");
    if (intent === "submit") redirect(`/portal/abstracts/${id}?submitted=1`);
    return { ok: true, message: "Draft saved.", id };
  }
  const { data, error } = await db
    .from("abstracts")
    .insert({ ...row, edition_id: edition.id, submitter_id: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "We couldn't save your abstract. Submissions may be closed." };
  revalidatePath("/portal", "layout");
  redirect(`/portal/abstracts/${data.id}${intent === "submit" ? "?submitted=1" : "?saved=1"}`);
}

export async function withdrawAbstract(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal");
  const id = String(form.get("id"));
  const { error } = await db.from("abstracts").update({ status: "withdrawn" }).eq("id", id).eq("submitter_id", user.id);
  if (error) return { ok: false, error: "This abstract can't be withdrawn. Please contact the team." };
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Your abstract has been withdrawn." };
}

/* ---------- Posters ---------- */
export async function uploadPoster(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/presenter");
  const abstractId = String(form.get("abstractId"));
  const orientation = form.get("orientation");
  const file = form.get("poster");
  if (orientation !== "landscape" && orientation !== "portrait") return { ok: false, fieldErrors: { orientation: "Choose landscape or portrait." } };
  if (!(file instanceof File) || file.size === 0) return { ok: false, fieldErrors: { poster: "Choose your poster file." } };
  if (!FILE_RULES.poster.types.includes(file.type)) return { ok: false, fieldErrors: { poster: `Upload a ${FILE_RULES.poster.label} file.` } };
  if (file.size > FILE_RULES.poster.maxMb * 1024 * 1024) return { ok: false, fieldErrors: { poster: `Files must be ${FILE_RULES.poster.maxMb} MB or smaller.` } };

  const { data: abs } = await db.from("abstracts").select("id,status").eq("id", abstractId).eq("submitter_id", user.id).maybeSingle();
  if (!abs || abs.status !== "accepted") return { ok: false, error: "Posters can only be uploaded for accepted abstracts." };

  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${abstractId}/${Date.now()}.${ext}`;
  const up = await db.storage.from("posters").upload(path, file, { contentType: file.type });
  if (up.error) return { ok: false, error: "Upload failed. Please try again." };
  const { error } = await db.from("poster_uploads").insert({ abstract_id: abstractId, file_path: path, orientation, uploaded_by: user.id });
  if (error) return { ok: false, error: "Upload saved but could not be recorded. Please contact the team." };
  revalidatePath("/portal/presenter");
  return { ok: true, message: "Poster uploaded. The conference team will review it." };
}

/* ---------- Slides and posters ---------- */
const recordSchema = z.object({
  kind: z.enum(["slides", "poster"]),
  title: z.string().trim().min(3, "Enter the title.").max(300),
  note: z.string().trim().max(2000).optional().default(""),
  path: z.string().min(10).max(400),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(120),
  size: z.coerce.number().int().positive().max(50 * 1024 * 1024),
});

/**
 * Records a file the presenter has already uploaded straight to private
 * storage from their browser (large files never pass through the website's
 * servers). The database checks the account type, approval and folder.
 */
export async function recordSubmission(input: z.input<typeof recordSchema>): Promise<ActionResult> {
  const { user, db, profile } = await requireUser("/portal/submission");
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the title and file." };
  const v = parsed.data;
  if (submissionKindFor(profile.accountType) !== v.kind || profile.accountStatus !== "approved")
    return { ok: false, error: "Your account can't submit this yet." };
  if (!v.path.startsWith(`${user.id}/`)) return { ok: false, error: "That upload doesn't belong to your account." };
  if (!resolveFileType(v.kind, v.name, v.type)) return { ok: false, error: `Upload a ${SUBMISSION_FILES[v.kind].label} file.` };

  const edition = await getEdition();
  const { data, error } = await db
    .from("presentation_submissions")
    .insert({ edition_id: edition.id, user_id: user.id, kind: v.kind, title: v.title, presenter_note: v.note, file_path: v.path, file_name: v.name, file_type: v.type, file_size: v.size })
    .select("id, version")
    .single();
  if (error || !data) return { ok: false, error: "Your file uploaded but we couldn't record it. Please try again." };
  if (user.email) {
    await sendEmail({ to: user.email, ...submissionReceivedEmail({ siteUrl: SITE_URL, name: profile.fullName, kind: v.kind, title: v.title, version: data.version }) });
  }
  revalidatePath("/portal", "layout");
  return { ok: true, message: data.version > 1 ? `Version ${data.version} submitted. The committee has been sent your update.` : "Submitted. The committee will review it and reply here." };
}
