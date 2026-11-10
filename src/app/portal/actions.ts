"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { abstractSchema, FILE_RULES } from "@/lib/validation/abstract";

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
  yearOfStudy: z.string().trim().max(40).optional().default(""),
});

export async function updateProfile(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/profile");
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const { error } = await db
    .from("profiles")
    .update({ full_name: parsed.data.fullName, institution: parsed.data.institution || null, programme: parsed.data.programme || null, year_of_study: parsed.data.yearOfStudy || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "We couldn't save your profile." };
  revalidatePath("/portal", "layout");
  return { ok: true, message: "Profile saved." };
}

/** Permanently deletes the account. Requires the service role key on the server; never exposed to the browser. */
export async function deleteAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, db } = await requireUser("/portal/profile");
  if (form.get("confirm") !== "DELETE") return { ok: false, fieldErrors: { confirm: "Type DELETE to confirm." } };
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return { ok: false, error: "Self-service deletion is not enabled yet. Please contact the team and we will delete your account." };
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: "We couldn't delete your account. Please contact the team." };
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
