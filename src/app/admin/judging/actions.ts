"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
import { isComplete, isKind } from "@/lib/judging";

const RESULTS = "/admin/judging";
const SETUP = "/admin/judging/setup";

function done(path: string, flash: string, error?: { message?: string } | null): never {
  revalidatePath(RESULTS);
  revalidatePath(SETUP);
  revalidatePath("/judge");
  const msg = error
    ? error.message?.includes("VIEW_AS") || error.message?.includes("read-only")
      ? "view_as"
      : /marking_closed|closed_at/.test(error.message ?? "")
        ? "needs_sql"
        : "error"
    : flash;
  redirect(`${path}${path.includes("?") ? "&" : "?"}${error ? "error" : "saved"}=${msg}`);
}

async function currentEdition(db: Awaited<ReturnType<typeof requireAccess>>["db"]) {
  const { data } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
  return data?.id as string | undefined;
}

/** Opens or closes judging, and releases feedback to presenters. */
export async function saveJudgingSettings(form: FormData) {
  const { db, profile } = await requireAccess("manage_judging", RESULTS);
  const edition = await currentEdition(db);
  if (!edition) done(RESULTS, "", { message: "no edition" });
  const released = form.get("released") === "on";
  const { data: before } = await db.from("judging_settings").select("released, released_at").eq("edition_id", edition).maybeSingle();
  const { error } = await db.from("judging_settings").upsert({
    edition_id: edition,
    open: form.get("open") === "on",
    released,
    release_scores: form.get("release_scores") === "on",
    release_names: form.get("release_names") === "on",
    released_at: released ? (before?.released ? before.released_at : new Date().toISOString()) : null,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/portal");
  revalidatePath("/portal/feedback");
  done(RESULTS, "settings", error);
}

const criterionSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  kind: z.enum(["oral", "poster"]),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300),
  max_score: z.coerce.number().int().min(1).max(100),
  sort: z.coerce.number().int().min(0).max(999),
});

export async function saveCriterion(form: FormData) {
  const { db } = await requireAccess("manage_judging", SETUP);
  const parsed = criterionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${SETUP}?error=criterion`);
  const { id, ...v } = parsed.data;
  const edition = await currentEdition(db);
  const { error } = id
    ? await db.from("judging_criteria").update(v).eq("id", id)
    : await db.from("judging_criteria").insert({ ...v, edition_id: edition });
  done(SETUP, "criteria", error);
}

export async function deleteCriterion(form: FormData) {
  const { db } = await requireAccess("manage_judging", SETUP);
  const id = String(form.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) redirect(SETUP);
  const { error } = await db.from("judging_criteria").delete().eq("id", id);
  done(SETUP, "criteria", error);
}

/** Which kinds a judge marks, and (optionally) exactly who. */
export async function saveJudgePanel(form: FormData) {
  const { db, profile } = await requireAccess("manage_judging", SETUP);
  const judge = String(form.get("judge_id") ?? "");
  if (!z.string().uuid().safeParse(judge).success) redirect(SETUP);
  const kinds = form.getAll("kinds").map(String).filter(isKind);
  if (!kinds.length) redirect(`${SETUP}?error=kinds#judge-${judge}`);
  const picked = form
    .getAll("assign")
    .map(String)
    .map((v) => v.split(":"))
    .filter(([id, k]) => z.string().uuid().safeParse(id).success && isKind(k) && kinds.includes(k))
    .map(([presenter_id, kind]) => ({ judge_id: judge, presenter_id, kind, created_by: profile.id }));
  const { error } = await db.from("judging_panel").upsert({ judge_id: judge, kinds, updated_at: new Date().toISOString() });
  if (error) done(SETUP, "", error);
  const { error: delError } = await db.from("judging_assignments").delete().eq("judge_id", judge);
  if (delError) done(SETUP, "", delError);
  const { error: insError } = picked.length ? await db.from("judging_assignments").insert(picked) : { error: null };
  done(SETUP, "judge", insError);
}

/** Where each presentation is on the day ("Board 12"), and the order judges see them in. */
export async function saveEntries(form: FormData) {
  const { db } = await requireAccess("manage_judging", SETUP);
  const rows: { presenter_id: string; kind: string; label: string; sort: number; updated_at: string }[] = [];
  for (const [k, v] of form.entries()) {
    const m = k.match(/^label:([0-9a-f-]{36}):(oral|poster)$/);
    if (!m) continue;
    const sort = Number(form.get(`sort:${m[1]}:${m[2]}`) ?? 0);
    rows.push({ presenter_id: m[1], kind: m[2], label: String(v).trim().slice(0, 80), sort: Number.isInteger(sort) && sort >= 0 ? Math.min(sort, 9999) : 0, updated_at: new Date().toISOString() });
  }
  const { error } = rows.length ? await db.from("judging_entries").upsert(rows) : { error: null };
  done(SETUP, "entries", error);
}

/** Closes (or reopens) marking for one presenter, so judges can't add or change marks for them. */
export async function setMarkingClosed(form: FormData) {
  const { db } = await requireAccess("manage_judging", RESULTS);
  const presenter = String(form.get("presenter_id") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!z.string().uuid().safeParse(presenter).success || !isKind(kind)) redirect(RESULTS);
  const closed = form.get("closed") === "1";
  const now = new Date().toISOString();
  const { error } = await db
    .from("judging_entries")
    .upsert({ presenter_id: presenter, kind, marking_closed: closed, closed_at: closed ? now : null, updated_at: now }, { onConflict: "presenter_id,kind" });
  done(`${RESULTS}?kind=${kind}`, closed ? "closed_one" : "reopened_one", error);
}

/** Closes marking for every presenter of one kind whose marking is complete (at least MIN_JUDGES submitted marks). */
export async function closeCompleteMarking(form: FormData) {
  const { db } = await requireAccess("manage_judging", RESULTS);
  const kind = String(form.get("kind") ?? "");
  if (!isKind(kind)) redirect(RESULTS);
  const edition = await currentEdition(db);
  if (!edition) done(RESULTS, "", { message: "no edition" });
  const { data, error: readError } = await db.from("judging_marks").select("presenter_id").eq("edition_id", edition).eq("kind", kind).eq("status", "submitted");
  if (readError) done(`${RESULTS}?kind=${kind}`, "", readError);
  const counts = new Map<string, number>();
  for (const r of (data ?? []) as { presenter_id: string }[]) counts.set(r.presenter_id, (counts.get(r.presenter_id) ?? 0) + 1);
  const now = new Date().toISOString();
  const rows = [...counts].filter(([, n]) => isComplete(n)).map(([presenter_id]) => ({ presenter_id, kind, marking_closed: true, closed_at: now, updated_at: now }));
  const { error } = rows.length ? await db.from("judging_entries").upsert(rows, { onConflict: "presenter_id,kind" }) : { error: null };
  done(`${RESULTS}?kind=${kind}`, "closed_complete", error);
}

export async function deleteMark(form: FormData) {
  const { db } = await requireAccess("manage_judging", RESULTS);
  const id = String(form.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) redirect(RESULTS);
  const { error } = await db.from("judging_marks").delete().eq("id", id);
  done(RESULTS, "mark_removed", error);
}

/** Links a speaker account to its speaker profile (or unlinks it). */
export async function linkSpeaker(form: FormData) {
  const { db } = await requireAccess("edit_website", SETUP);
  const account = String(form.get("profile_id") ?? "");
  const speaker = String(form.get("speaker_id") ?? "");
  if (!z.string().uuid().safeParse(account).success) redirect(SETUP);
  // One speaker profile per account: clear any earlier link first.
  const { error: clearError } = await db.from("speakers").update({ profile_id: null }).eq("profile_id", account);
  if (clearError) done(SETUP, "", clearError);
  const { error } = z.string().uuid().safeParse(speaker).success ? await db.from("speakers").update({ profile_id: account }).eq("id", speaker) : { error: null };
  revalidatePath("/portal");
  done(SETUP, "speaker", error);
}
