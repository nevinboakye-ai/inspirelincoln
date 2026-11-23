"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";

export type ModerationResult = { ok: boolean; error?: string; count?: number };

const VIEW_AS = "You're viewing as someone else, so changes are switched off.";
const ids = z.array(z.uuid()).min(1).max(200);

function refresh() {
  revalidatePath("/admin/gallery");
  revalidatePath("/portal/gallery");
  revalidatePath("/portal/after");
}

/** Accept or reject photos, one or many. Rejecting can carry a short note the uploader sees. */
export async function reviewPhotos(input: { ids: string[]; status: "accepted" | "rejected" | "pending"; note?: string }): Promise<ModerationResult> {
  const { db } = await requireAccess("moderate_gallery", "/admin/gallery");
  const v = z.object({ ids, status: z.enum(["accepted", "rejected", "pending"]), note: z.string().trim().max(300).optional().default("") }).safeParse(input);
  if (!v.success) return { ok: false, error: "Please choose some photos, and keep the note under 300 characters." };
  const { data, error } = await db.rpc("gallery_review", { p_ids: v.data.ids, p_status: v.data.status, p_note: v.data.note });
  if (error) return { ok: false, error: /VIEW_AS/.test(error.message) ? VIEW_AS : "That couldn't be saved. Please try again." };
  if (typeof data !== "number" || data < 0) return { ok: false, error: "You don't have permission to moderate the gallery." };
  refresh();
  return { ok: true, count: data };
}

/** Deletes photos for good, files and all. */
export async function deletePhotos(input: string[]): Promise<ModerationResult> {
  const { db } = await requireAccess("moderate_gallery", "/admin/gallery");
  const v = ids.safeParse(input);
  if (!v.success) return { ok: false, error: "Please choose some photos." };
  const { data, error } = await db.from("gallery_photos").delete().in("id", v.data).select("path");
  if (error) return { ok: false, error: /VIEW_AS/.test(error.message) ? VIEW_AS : "Those photos couldn't be deleted. Please try again." };
  const paths = (data ?? []).map((r) => r.path as string);
  if (paths.length) await db.storage.from("gallery").remove(paths);
  refresh();
  return { ok: true, count: paths.length };
}
