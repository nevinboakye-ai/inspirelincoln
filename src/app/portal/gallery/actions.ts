"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { GALLERY_PATH } from "@/lib/post-conference/photos";

export type GalleryResult = { ok: boolean; error?: string; status?: "pending" | "accepted" };

const VIEW_AS = "You're viewing as someone else, so changes are switched off.";

const ADD_ERRORS: Record<string, string> = {
  signed_out: "Your session has expired. Please sign in again.",
  not_allowed: "Give your conference feedback first, then you can add photos.",
  folder: "That upload doesn't belong to your account.",
  missing: "That photo didn't finish uploading. Please try again.",
  too_many: "You have 40 photos waiting for the committee. Please wait for those to be checked before adding more.",
};

const addSchema = z.object({
  path: z.string().regex(GALLERY_PATH),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
  caption: z.string().trim().max(200).optional().default(""),
});

/**
 * Records a photo the browser has already uploaded to the person's own
 * private gallery folder. It waits for the committee, unless they moderate
 * the gallery themselves.
 */
export async function recordGalleryPhoto(input: z.input<typeof addSchema>): Promise<GalleryResult> {
  const { db, user } = await requireUser("/portal/gallery");
  const v = addSchema.safeParse(input);
  if (!v.success || !v.data.path.startsWith(`${user.id}/`)) return { ok: false, error: "That upload doesn't belong to your account." };
  const { data, error } = await db.rpc("gallery_add", { p_path: v.data.path, p_width: v.data.width, p_height: v.data.height, p_caption: v.data.caption });
  const r = (data ?? {}) as { error?: string; status?: "pending" | "accepted" };
  if (error || r.error) {
    // Don't leave a file behind that nothing points to.
    await db.storage.from("gallery").remove([v.data.path]);
    if (error && /VIEW_AS/.test(error.message)) return { ok: false, error: VIEW_AS };
    return { ok: false, error: ADD_ERRORS[r.error ?? ""] ?? "We couldn't add that photo. Please try again." };
  }
  revalidatePath("/portal/gallery");
  revalidatePath("/admin/gallery");
  return { ok: true, status: r.status };
}

/** Takes one of their own photos out of the gallery, file and all. */
export async function deleteMyPhoto(id: string): Promise<GalleryResult> {
  const { db, user } = await requireUser("/portal/gallery");
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That photo couldn't be found." };
  const { data, error } = await db.from("gallery_photos").delete().eq("id", id).eq("uploaded_by", user.id).select("path").maybeSingle();
  if (error) return { ok: false, error: /VIEW_AS/.test(error.message) ? VIEW_AS : "We couldn't remove that photo. Please try again." };
  if (data?.path) await db.storage.from("gallery").remove([data.path as string]);
  revalidatePath("/portal/gallery");
  revalidatePath("/portal/after");
  revalidatePath("/admin/gallery");
  return { ok: true };
}

/** Anyone who can see a photo can ask for it to come down. It's hidden until the committee looks at it again. */
export async function reportPhoto(id: string, note: string): Promise<GalleryResult> {
  const { db } = await requireUser("/portal/gallery");
  const v = z.object({ id: z.uuid(), note: z.string().trim().max(300) }).safeParse({ id, note });
  if (!v.success) return { ok: false, error: "Please keep the reason under 300 characters." };
  const { data, error } = await db.rpc("gallery_report", { p_id: v.data.id, p_note: v.data.note });
  if (error) return { ok: false, error: /VIEW_AS/.test(error.message) ? VIEW_AS : "We couldn't send that. Please try again." };
  if (data !== true) return { ok: false, error: "That photo has already been taken down." };
  revalidatePath("/portal/gallery");
  revalidatePath("/portal/after");
  revalidatePath("/admin/gallery");
  return { ok: true };
}
