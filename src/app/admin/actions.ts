"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEntityAccess, currentEditionId, type Db } from "@/lib/admin/server";
import { getEntity } from "@/lib/admin/entities";
import { requireRole } from "@/lib/auth";
import { fromZonedInputValue } from "@/lib/time";
import type { ActionResult } from "@/app/portal/actions";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_IMAGE_MB = 8;

function refresh(paths: string[]) {
  for (const p of paths) revalidatePath(p, p === "/" ? "layout" : "page");
  revalidatePath("/admin", "layout");
}

/** Uploads an image to the public media bucket and returns its public URL. */
async function uploadImage(db: Db, file: File, folder: string) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Images must be JPEG, PNG, WebP or AVIF.");
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`Images must be ${MAX_IMAGE_MB} MB or smaller.`);
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error("The image could not be uploaded.");
  return db.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function saveEntity(_: ActionResult, form: FormData): Promise<ActionResult> {
  const entity = getEntity(String(form.get("__entity")));
  if (!entity) return { ok: false, error: "Unknown content type." };
  const { db } = await requireEntityAccess(entity);
  const id = String(form.get("__id") || "") || null;

  const row: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};
  let speakerIds: string[] | null = null;

  for (const f of entity.fields) {
    const raw = form.get(f.name);
    const s = typeof raw === "string" ? raw.trim() : "";
    try {
      switch (f.type) {
        case "boolean":
          row[f.name] = raw === "on";
          break;
        case "number":
          if (!s) row[f.name] = f.name === "sort" ? 0 : null;
          else if (Number.isNaN(Number(s))) fieldErrors[f.name] = "Enter a number.";
          else row[f.name] = Number(s);
          break;
        case "datetime":
          if (!s) row[f.name] = f.name === "published_at" ? new Date().toISOString() : null;
          else row[f.name] = fromZonedInputValue(s) ?? (fieldErrors[f.name] = "Enter a valid date and time.", null);
          break;
        case "lines":
          row[f.name] = s.split("\n").map((l) => l.trim()).filter(Boolean);
          break;
        case "links": {
          const links = s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
            const [label, url] = l.includes("|") ? l.split("|").map((x) => x.trim()) : [l, l];
            return { label, url };
          });
          if (links.some((l) => !/^https?:\/\//.test(l.url))) fieldErrors[f.name] = "Each link needs a URL starting with https://";
          row[f.name] = links;
          break;
        }
        case "url":
          if (s && !/^https?:\/\//i.test(s)) fieldErrors[f.name] = "Enter a full URL starting with https://";
          row[f.name] = s || null;
          break;
        case "image": {
          const file = form.get(`${f.name}__file`);
          if (file instanceof File && file.size > 0) row[f.name] = await uploadImage(db, file, entity.key);
          else if (s && !/^(https?:\/\/|\/[\w./-]+$)/i.test(s)) fieldErrors[f.name] = "Enter a full image URL or upload a file.";
          else row[f.name] = s || null;
          break;
        }
        case "location": {
          const la = String(form.get("lat") ?? "").trim();
          const ln = String(form.get("lng") ?? "").trim();
          if (!la && !ln) {
            row.lat = null;
            row.lng = null;
          } else if (!la || !ln || !Number.isFinite(Number(la)) || !Number.isFinite(Number(ln)) || Math.abs(Number(la)) > 90 || Math.abs(Number(ln)) > 180) {
            fieldErrors[f.name] = "Enter both a latitude and a longitude, or remove the pin.";
          } else {
            row.lat = Number(la);
            row.lng = Number(ln);
          }
          break;
        }
        case "speakers":
          speakerIds = form.getAll(f.name).map(String).filter(Boolean);
          break;
        case "relation":
        case "select":
        case "date":
        case "time":
          row[f.name] = s || null;
          break;
        default:
          row[f.name] = s || (f.required ? "" : f.type === "textarea" ? "" : null);
      }
    } catch (e) {
      fieldErrors[f.name] = (e as Error).message;
    }
    if (f.required && f.type !== "boolean" && f.type !== "location" && (row[f.name] === null || row[f.name] === "" || row[f.name] === undefined)) fieldErrors[f.name] = `${f.label} is required.`;
    if (f.name === "slug" && s && !/^[a-z0-9-]+$/.test(s)) fieldErrors.slug = "Use lowercase letters, numbers and hyphens only.";
  }
  // Text columns that are NOT NULL default to '' rather than null.
  for (const f of entity.fields) if ((f.type === "textarea" || f.type === "text") && row[f.name] === null && !f.required) row[f.name] = "";
  for (const k of ["credentials", "position", "institution", "specialty", "bio", "facilitator", "facilitator_bio", "notes", "organisation", "eligibility", "building", "floor", "directions", "credit", "host_institution", "highlights", "code"])
    if (row[k] === "") row[k] = null;

  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  let savedId = id;
  if (id) {
    const { error } = await db.from(entity.table).update(row).eq("id", id);
    if (error) return { ok: false, error: friendly(error.message) };
  } else {
    if (entity.editionScoped) row.edition_id = await currentEditionId(db);
    const { data, error } = await db.from(entity.table).insert(row).select("id").single();
    if (error || !data) return { ok: false, error: friendly(error?.message) };
    savedId = data.id;
  }

  if (speakerIds && savedId) {
    await db.from("session_speakers").delete().eq("session_id", savedId);
    if ((speakerIds as string[]).length) {
      const { error } = await db.from("session_speakers").insert((speakerIds as string[]).map((speaker_id) => ({ session_id: savedId, speaker_id })));
      if (error) return { ok: false, error: "Saved, but speakers could not be linked." };
    }
  }

  refresh(entity.revalidate);
  if (!id) redirect(`/admin/content/${entity.key}/${savedId}?created=1`);
  return { ok: true, message: `${entity.singular[0].toUpperCase()}${entity.singular.slice(1)} saved.`, id: savedId ?? undefined };
}

export async function deleteEntity(_: ActionResult, form: FormData): Promise<ActionResult> {
  const entity = getEntity(String(form.get("__entity")));
  if (!entity) return { ok: false, error: "Unknown content type." };
  const { db } = await requireEntityAccess(entity);
  const id = String(form.get("__id"));
  const { error } = await db.from(entity.table).delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(entity.revalidate);
  redirect(`/admin/content/${entity.key}?deleted=1`);
}

function friendly(msg?: string) {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("duplicate key")) return "Another item already uses that slug or number.";
  if (msg.includes("violates foreign key") || msg.includes("restrict")) return "This item is still referenced by other records.";
  if (msg.includes("check constraint")) return "One of the values isn't allowed. Check dates, URLs and numbers.";
  if (msg.includes("row-level security")) return "You don't have permission to make this change.";
  return "Something went wrong. Please try again.";
}

/* ---------- Conference settings (current edition) ---------- */
const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function saveSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["editor"], "/admin/settings");
  const id = text(form.get("id"));
  const fieldErrors: Record<string, string> = {};
  const time = (k: string) => {
    const v = text(form.get(k));
    if (v && !/^\d{2}:\d{2}$/.test(v)) fieldErrors[k] = "Use 24-hour HH:MM.";
    return v || null;
  };
  const int = (k: string, min = 0) => {
    const v = text(form.get(k));
    if (!v) return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min) fieldErrors[k] = `Enter a whole number of at least ${min}.`;
    return n;
  };
  const registrationUrl = text(form.get("registration_url")) || null;
  if (registrationUrl && !/^https:\/\//i.test(registrationUrl)) fieldErrors.registration_url = "The registration link must start with https://";
  const status = text(form.get("status")) || null;
  const statuses = ["registration_soon", "registration_open", "registration_closed", "underway", "concluded"];
  if (status && !statuses.includes(status)) fieldErrors.status = "Choose a status.";
  const startTime = time("start_time");
  const endTime = time("end_time");
  if (startTime && endTime && endTime <= startTime) fieldErrors.end_time = "The end time must be after the start time.";
  for (const k of ["name", "theme", "event_date", "venue_name"]) if (!text(form.get(k))) fieldErrors[k] = "This field is required.";
  const sectionLimit = int("section_word_limit", 10);
  const totalLimit = int("total_word_limit", 10);
  const maxFileMb = int("max_file_mb", 1);
  if (maxFileMb && maxFileMb > 10) fieldErrors.max_file_mb = "The storage bucket accepts files up to 10 MB.";
  const opensAt = text(form.get("opens_at"));
  const closesAt = text(form.get("closes_at"));
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const { data: current } = await db.from("editions").select("abstract_config").eq("id", id).maybeSingle();
  if (!current) return { ok: false, error: "Edition not found." };
  const row = {
    name: text(form.get("name")),
    theme: text(form.get("theme")),
    theme_statement: text(form.get("theme_statement")),
    event_date: text(form.get("event_date")),
    start_time: startTime,
    end_time: endTime,
    venue_name: text(form.get("venue_name")),
    venue_institution: text(form.get("venue_institution")),
    venue_address: text(form.get("venue_address")),
    venue_notes: text(form.get("venue_notes")) || null,
    expected_attendance: int("expected_attendance", 1),
    status,
    registration_url: registrationUrl,
    registration_note: text(form.get("registration_note")) || null,
    event_day_mode: form.get("event_day_mode") === "on",
    post_event_mode: form.get("post_event_mode") === "on",
    poster_deadline: text(form.get("poster_deadline")) || null,
    poster_requirements: lines(form.get("poster_requirements")),
    abstract_config: {
      ...(current.abstract_config as object),
      submissionsOpen: form.get("submissions_open") === "on",
      opensAt: opensAt ? fromZonedInputValue(opensAt) : null,
      closesAt: closesAt ? fromZonedInputValue(closesAt) : null,
      sectionWordLimit: sectionLimit ?? 150,
      totalWordLimit: totalLimit ?? 300,
      categories: lines(form.get("categories")),
      presentationTypes: lines(form.get("presentation_types")),
      allowFiles: form.get("allow_files") === "on",
      maxFileMb: maxFileMb ?? 10,
      eligibility: lines(form.get("eligibility")),
      formatting: lines(form.get("formatting")),
    },
  };
  const { error } = await db.from("editions").update(row).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. The public site has been refreshed." };
}

export async function setCurrentEdition(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/settings");
  const id = text(form.get("edition"));
  const { error: e1 } = await db.from("editions").update({ is_current: false }).eq("is_current", true);
  const { error: e2 } = await db.from("editions").update({ is_current: true }).eq("id", id);
  if (e1 || e2) return { ok: false, error: friendly((e1 ?? e2)?.message) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Current edition changed." };
}
