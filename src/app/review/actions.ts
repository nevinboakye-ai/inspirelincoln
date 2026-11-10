"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "@/app/portal/actions";

/** Saves or submits a review. RLS limits writes to the reviewer's own assignments; a trigger locks submitted reviews. */
export async function saveReview(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["reviewer", "editor"], "/review");
  const assignmentId = String(form.get("assignmentId") ?? "");
  const intent = form.get("intent") === "submit" ? "submit" : "draft";

  const { data: assignment } = await db.from("review_assignments").select("id, abstract_id, abstracts(edition_id)").eq("id", assignmentId).maybeSingle();
  if (!assignment) return { ok: false, error: "This review assignment was not found." };
  const editionId = (assignment.abstracts as unknown as { edition_id: string } | null)?.edition_id;
  const { data: criteria } = await db.from("review_criteria").select("id, label, max_score").eq("edition_id", editionId ?? "");

  const scores: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};
  for (const c of criteria ?? []) {
    const raw = form.get(`score_${c.id}`);
    if (raw === null || raw === "") {
      if (intent === "submit") fieldErrors[`score_${c.id}`] = `Score “${c.label}”.`;
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > c.max_score) fieldErrors[`score_${c.id}`] = `Enter a whole number from 0 to ${c.max_score}.`;
    else scores[c.id] = n;
  }
  const parsed = z
    .object({
      comments: z.string().trim().max(5000, "Keep comments under 5,000 characters."),
      confidentialComments: z.string().trim().max(5000, "Keep comments under 5,000 characters."),
      recommendation: z.enum(["accept", "reject", "waitlist", ""]),
    })
    .safeParse({
      comments: String(form.get("comments") ?? ""),
      confidentialComments: String(form.get("confidentialComments") ?? ""),
      recommendation: String(form.get("recommendation") ?? ""),
    });
  if (!parsed.success) for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
  if (intent === "submit" && parsed.success && !parsed.data.recommendation) fieldErrors.recommendation = "Choose a recommendation.";
  if (Object.keys(fieldErrors).length || !parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const row = {
    assignment_id: assignmentId,
    scores,
    comments: parsed.data.comments,
    confidential_comments: parsed.data.confidentialComments,
    recommendation: parsed.data.recommendation || null,
    status: intent === "submit" ? "submitted" : "draft",
  };
  const { error } = await db.from("reviews").upsert(row, { onConflict: "assignment_id" });
  if (error) return { ok: false, error: error.message.includes("cannot be changed") ? "This review has already been submitted and is locked." : "The review could not be saved. Please try again." };
  revalidatePath("/review");
  revalidatePath(`/review/${assignmentId}`);
  return { ok: true, message: intent === "submit" ? "Review submitted. Thank you." : "Draft saved." };
}
