"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { uniKey } from "@/lib/university-logos";

type Result = { ok: boolean; error?: string; message?: string } | null;
const MAX = 512 * 1024;

/** What the bytes really are, whatever the browser claimed. SVG isn't accepted, as it can carry scripts. */
function imageType(b: Uint8Array): { ext: "png" | "jpg" | "webp"; type: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "university";

function refresh() {
  revalidatePath("/admin/content/universities");
  revalidatePath("/portal", "layout");
  revalidatePath("/m/[code]", "page");
}

/** Adds or replaces a university's logo. */
export async function saveUniversityLogo(_: Result, form: FormData): Promise<Result> {
  const { db, user } = await requireAccess("edit_website", "/admin/content/universities");
  const institution = String(form.get("institution") ?? "").trim().slice(0, 160);
  const file = form.get("logo");
  if (!institution) return { ok: false, error: "Choose a university." };
  if (!(file instanceof File) || !file.size) return { ok: false, error: "Choose a logo file." };
  if (file.size > MAX) return { ok: false, error: "That file is over 512 KB. Please use a smaller PNG, JPEG or WebP." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageType(bytes);
  if (!kind) return { ok: false, error: "Please use a PNG, JPEG or WebP image. A PNG with a transparent background looks best." };

  const key = uniKey(institution);
  const { data: old } = await db.from("university_logos").select("path").eq("institution_key", key).maybeSingle();
  const path = `universities/${slug(institution)}-${crypto.randomUUID().slice(0, 8)}.${kind.ext}`;
  const up = await db.storage.from("media").upload(path, bytes, { contentType: kind.type, upsert: false, cacheControl: "31536000" });
  if (up.error) return { ok: false, error: "We couldn't upload that logo. Please try again." };
  const { error } = await db.from("university_logos").upsert({ institution_key: key, institution, path, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) {
    await db.storage.from("media").remove([path]);
    return { ok: false, error: "We couldn't save that logo. Please try again." };
  }
  if (old?.path && old.path !== path) await db.storage.from("media").remove([old.path]);
  refresh();
  return { ok: true, message: `Logo saved for ${institution}.` };
}

/** Removes a university's logo; cards go back to showing its initials. */
export async function removeUniversityLogo(_: Result, form: FormData): Promise<Result> {
  const { db } = await requireAccess("edit_website", "/admin/content/universities");
  const key = uniKey(String(form.get("institution") ?? ""));
  const { data: old } = await db.from("university_logos").select("path").eq("institution_key", key).maybeSingle();
  if (!old) return { ok: true, message: "Logo removed." };
  const { error } = await db.from("university_logos").delete().eq("institution_key", key);
  if (error) return { ok: false, error: "We couldn't remove that logo. Please try again." };
  await db.storage.from("media").remove([old.path]);
  refresh();
  return { ok: true, message: "Logo removed." };
}
