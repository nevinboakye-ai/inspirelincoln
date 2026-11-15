"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type SpeakerResult = { ok: boolean; message?: string; error?: string } | null;

const schema = z.object({
  position: z.string().trim().max(160, "Keep your job title under 160 characters."),
  institution: z.string().trim().max(160, "Keep your organisation under 160 characters."),
  credentials: z.string().trim().max(80, "Keep post-nominals under 80 characters."),
  bio: z.string().trim().max(2000, "Keep your biography under 2,000 characters."),
});

/** A speaker updates their own public speaker profile. */
export async function saveMySpeaker(_: SpeakerResult, form: FormData): Promise<SpeakerResult> {
  const { db } = await requireUser("/portal/speaker");
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const v = parsed.data;
  const { data, error } = await db.rpc("update_my_speaker", { p_position: v.position, p_institution: v.institution, p_credentials: v.credentials, p_bio: v.bio });
  if (error) return { ok: false, error: error.message.includes("VIEW_AS") ? "You're viewing as someone else, so changes are switched off." : "Your profile couldn't be saved. Please try again." };
  if (!data) return { ok: false, error: "Your account isn't linked to a speaker profile yet." };
  revalidatePath("/portal");
  revalidatePath("/speakers", "layout");
  return { ok: true, message: "Saved. Your speaker profile is up to date." };
}
