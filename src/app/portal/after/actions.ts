"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { feedbackSchema, partsFor, type FeedbackInput } from "@/lib/post-conference/feedback";
import { presenterKindOf } from "@/lib/accounts";

export type FeedbackResult = { ok: boolean; error?: string; step?: "overall" | "recommend" };

const ERRORS: Record<string, string> = {
  signed_out: "Your session has expired. Please sign in again.",
  not_approved: "Feedback opens once your place is confirmed.",
  no_edition: "Feedback isn't open yet.",
};

/** Sends someone's conference feedback. Once only: the database keeps the first answer. */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const { db, profile } = await requireUser("/portal/after");
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const at = issue?.path[0];
    return {
      ok: false,
      error: issue?.message && !/^(Invalid|Too)/.test(issue.message) ? issue.message : "Please check your answers.",
      step: at === "overall" ? "overall" : at === "recommend" ? "recommend" : undefined,
    };
  }
  const v = parsed.data;
  // Only keep ratings for the parts this person was asked about.
  const allowed = new Set(partsFor(Boolean(presenterKindOf(profile))).map((p) => p.id));
  const parts = Object.fromEntries(Object.entries(v.parts).filter(([k]) => allowed.has(k)));

  const { data, error } = await db.rpc("submit_conference_feedback", {
    p_overall: v.overall,
    p_recommend: v.recommend,
    p_parts: parts,
    p_highlights: v.highlights,
    p_highlight_note: v.highlightNote,
    p_improvements: v.improvements,
    p_improve_note: v.improveNote,
    p_comments: v.comments,
    p_quote_ok: v.quoteOk,
  });
  if (error) {
    if (/VIEW_AS/.test(error.message)) return { ok: false, error: "You're viewing as someone else, so nothing was sent." };
    return { ok: false, error: "We couldn't send your feedback. Please try again." };
  }
  if (data !== "ok") return { ok: false, error: ERRORS[String(data)] ?? "We couldn't send your feedback. Please try again." };
  revalidatePath("/portal", "layout");
  return { ok: true };
}
