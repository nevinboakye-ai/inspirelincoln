"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";

/** Marks someone who'd like help with their own research as contacted, or not yet. */
export async function markResearchContacted(input: { userId: string; contacted: boolean }): Promise<{ ok: boolean; error?: string }> {
  const { db } = await requireAccess("view_feedback", "/admin/feedback");
  const v = z.object({ userId: z.uuid(), contacted: z.boolean() }).safeParse(input);
  if (!v.success) return { ok: false, error: "That couldn't be saved." };
  const { error } = await db.rpc("research_interest_mark", { p_user: v.data.userId, p_contacted: v.data.contacted });
  if (error) return { ok: false, error: /VIEW_AS/.test(error.message) ? "You're viewing as someone else, so changes are switched off." : "That couldn't be saved. Please try again." };
  revalidatePath("/admin/feedback");
  return { ok: true };
}
