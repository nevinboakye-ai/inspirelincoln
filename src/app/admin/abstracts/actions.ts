"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "@/app/portal/actions";

const DECISIONS = ["submitted", "under_review", "accepted", "rejected", "waitlisted"] as const;

export async function assignReviewer(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user } = await requireRole(["admin"], "/admin/abstracts");
  const abstractId = String(form.get("abstractId"));
  const reviewerId = String(form.get("reviewerId") ?? "");
  if (!reviewerId) return { ok: false, error: "Choose a reviewer." };
  const { data: abs } = await db.from("abstracts").select("submitter_id, status").eq("id", abstractId).maybeSingle();
  if (!abs) return { ok: false, error: "Abstract not found." };
  if (abs.submitter_id === reviewerId) return { ok: false, error: "Authors can't review their own abstract." };
  const { error } = await db.from("review_assignments").insert({ abstract_id: abstractId, reviewer_id: reviewerId, assigned_by: user.id });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "That reviewer is already assigned." : "Could not assign the reviewer." };
  if (abs.status === "submitted") await db.from("abstracts").update({ status: "under_review" }).eq("id", abstractId);
  revalidatePath(`/admin/abstracts/${abstractId}`);
  return { ok: true, message: "Reviewer assigned." };
}

export async function unassignReviewer(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/abstracts");
  const id = String(form.get("assignmentId"));
  const abstractId = String(form.get("abstractId"));
  const { error } = await db.from("review_assignments").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not remove the assignment." };
  revalidatePath(`/admin/abstracts/${abstractId}`);
  return { ok: true, message: "Assignment removed (including any review)." };
}

export async function decideAbstract(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/abstracts");
  const id = String(form.get("abstractId"));
  const status = String(form.get("status")) as (typeof DECISIONS)[number];
  if (!DECISIONS.includes(status)) return { ok: false, error: "Choose a valid status." };
  const note = String(form.get("decisionNote") ?? "").trim().slice(0, 2000) || null;
  const type = String(form.get("presentationType") ?? "").trim() || null;
  const decided = ["accepted", "rejected", "waitlisted"].includes(status);
  const { error } = await db
    .from("abstracts")
    .update({ status, decision_note: note, presentation_type: status === "accepted" ? type : null, decided_at: decided ? new Date().toISOString() : null, ...(status !== "accepted" ? { showcase_published: false } : {}) })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save the decision." };
  revalidatePath(`/admin/abstracts/${id}`);
  revalidatePath("/admin/abstracts");
  revalidatePath("/");
  return { ok: true, message: "Decision saved. The author sees it in their portal." };
}

export async function setShowcase(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/abstracts");
  const id = String(form.get("abstractId"));
  const publish = form.get("publish") === "on";
  const summary = String(form.get("summary") ?? "").trim().slice(0, 1200) || null;
  const { data: a } = await db.from("abstracts").select("consent_showcase, status").eq("id", id).maybeSingle();
  if (publish && (!a?.consent_showcase || a.status !== "accepted")) return { ok: false, error: "Only accepted abstracts whose authors consented can be published." };
  const { error } = await db.from("abstracts").update({ showcase_published: publish, showcase_summary: summary }).eq("id", id);
  if (error) return { ok: false, error: "Could not update the showcase." };
  revalidatePath("/");
  revalidatePath(`/admin/abstracts/${id}`);
  return { ok: true, message: publish ? "Published to the research showcase." : "Showcase settings saved." };
}
