"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { INSTRUMENT_VERSION, STAGES, validateAnswers } from "@/lib/research/instrument";
import { RESEARCH_LATER_COOKIE, getStudySettings } from "@/lib/research/server";

export type ResearchResult = { ok: boolean; error?: string; item?: string; code?: string };

const NOT_READY = "The research study isn't set up yet.";

function friendly(message: string | undefined) {
  // Our own database messages are written for people; anything else isn't.
  if (message && /study|questionnaire|withdrawn|taking part|participants|delegates and presenters|completed/i.test(message)) return message;
  return "We couldn't save that. Please try again.";
}

/** Take part (with consent) or say no thanks. */
export async function decideResearch(input: { decision: "consented" | "declined"; consent?: Record<string, boolean> }): Promise<ResearchResult> {
  const { db } = await requireUser("/portal/research");
  const v = z.object({ decision: z.enum(["consented", "declined"]), consent: z.record(z.string(), z.boolean()).optional() }).safeParse(input);
  if (!v.success) return { ok: false, error: "That choice isn't valid." };
  const { ready, settings } = await getStudySettings(db);
  if (!ready) return { ok: false, error: NOT_READY };
  const c = v.data.consent ?? {};
  if (v.data.decision === "consented" && !["read", "age", "voluntary", "confidential", "agree"].every((k) => c[k] === true)) {
    return { ok: false, error: "To take part, please tick each of the required statements." };
  }
  const { data, error } = await db.rpc("research_decide", {
    p_decision: v.data.decision,
    p_consent_version: v.data.decision === "consented" ? `${settings.infoVersion}` : null,
    p_contact: c.contact === true,
    p_linkage: c.linkage === true,
    p_sharing: c.sharing === true,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  (await cookies()).delete(RESEARCH_LATER_COOKIE);
  revalidatePath("/portal", "layout");
  return { ok: true, code: typeof data === "string" ? data : undefined };
}

/** "Ask me later": hides the invitation until their next visit (12 hours). */
export async function researchLater() {
  (await cookies()).set(RESEARCH_LATER_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12 });
}

/** Submit one questionnaire. Every answer is checked against the questionnaire before it is stored. */
export async function submitResearch(input: { stage: string; answers: unknown; startedAt?: string | null }): Promise<ResearchResult> {
  const { db } = await requireUser("/portal/research");
  const stage = z.enum(STAGES).safeParse(input.stage);
  if (!stage.success) return { ok: false, error: "Unknown questionnaire." };
  const checked = validateAnswers(stage.data, input.answers);
  if (!checked.ok) return { ok: false, error: checked.error, item: checked.item };
  const started = input.startedAt && !Number.isNaN(Date.parse(input.startedAt)) ? new Date(input.startedAt).toISOString() : null;
  const { error } = await db.rpc("research_submit", { p_stage: stage.data, p_answers: checked.answers, p_version: INSTRUMENT_VERSION, p_started_at: started });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/portal", "layout");
  return { ok: true };
}

/** Change the optional consent choices. */
export async function updateResearchConsent(input: { contact: boolean; linkage: boolean; sharing: boolean }): Promise<ResearchResult> {
  const { db } = await requireUser("/portal/research");
  const v = z.object({ contact: z.boolean(), linkage: z.boolean(), sharing: z.boolean() }).safeParse(input);
  if (!v.success) return { ok: false, error: "That change isn't valid." };
  const { error } = await db.rpc("research_update_consent", { p_contact: v.data.contact, p_linkage: v.data.linkage, p_sharing: v.data.sharing });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/portal/research");
  return { ok: true };
}

/** Stop taking part, keeping or deleting the answers given so far. */
export async function withdrawResearch(input: { deleteAnswers: boolean }): Promise<ResearchResult> {
  const { db } = await requireUser("/portal/research");
  const { error } = await db.rpc("research_withdraw", { p_delete: input.deleteAnswers === true });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/portal", "layout");
  return { ok: true };
}
