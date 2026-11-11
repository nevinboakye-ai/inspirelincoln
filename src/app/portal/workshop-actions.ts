"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type RankResult = { ok: true; savedAt: string } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  RANKING_CLOSED: "Workshop choices have closed, so your picks can't be changed now. If something's wrong, send the committee an enquiry from My Hub.",
  NOT_CONFIRMED: "You can choose workshops once your place is confirmed.",
  BAD_RANKING: "The list of workshops has changed. Please refresh the page and try again.",
  VIEW_AS: "You're viewing as someone else, so changes are switched off.",
};

/** Saves a delegate's order of preference for the workshops, most wanted first. */
export async function saveWorkshopRanking(ids: string[]): Promise<RankResult> {
  const { db } = await requireUser("/portal");
  const parsed = z.array(z.string().uuid()).min(1).max(20).safeParse(ids);
  if (!parsed.success) return { ok: false, error: MESSAGES.BAD_RANKING! };
  const { data, error } = await db.rpc("workshop_ranking_save", { p_ranking: parsed.data });
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { ok: false, error: key ? MESSAGES[key]! : "We couldn't save your choices. Please try again." };
  }
  revalidatePath("/admin/workshops");
  return { ok: true, savedAt: String(data) };
}
