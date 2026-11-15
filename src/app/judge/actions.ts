"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parseScan } from "@/lib/card";
import { isKind, judgingError, type JudgingKind } from "@/lib/judging";

export type SaveResult = { ok: true; status: "draft" | "submitted"; total: number; maxTotal: number; savedAt: string } | { ok: false; error: string };

const markSchema = z.object({
  presenterId: z.string().uuid(),
  kind: z.enum(["oral", "poster"]),
  scores: z.record(z.string().uuid(), z.number().int().min(0).max(100)),
  strengths: z.string().max(3000, "Keep “What went well” under 3,000 characters."),
  improvements: z.string().max(3000, "Keep “What to improve” under 3,000 characters."),
  note: z.string().max(2000, "Keep the note for the committee under 2,000 characters."),
  submit: z.boolean(),
});

/** Saves a judge's marks and feedback. The database checks who is asking and every rule. */
export async function saveMark(input: z.input<typeof markSchema>): Promise<SaveResult> {
  const { db, profile } = await requireUser("/judge");
  if (!profile.access.can.judge_presentations && !profile.access.owner) return { ok: false, error: judgingError("NOT_ALLOWED") };
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your marks and try again." };
  const v = parsed.data;
  const { data, error } = await db.rpc("save_judging_mark", {
    p_presenter: v.presenterId,
    p_kind: v.kind,
    p_scores: v.scores,
    p_strengths: v.strengths,
    p_improvements: v.improvements,
    p_note: v.note,
    p_submit: v.submit,
  });
  if (error) return { ok: false, error: judgingError(error.message) };
  const res = data as { status: "draft" | "submitted"; total: number; max_total: number };
  if (v.submit || res.status === "submitted") {
    revalidatePath("/judge");
    revalidatePath("/admin/judging");
  }
  return { ok: true, status: res.status, total: res.total, maxTotal: res.max_total, savedAt: new Date().toISOString() };
}

export type LookupResult =
  | { ok: true; presenterId: string; name: string | null; kinds: JudgingKind[] }
  | { ok: false; error: string };

/** Finds a presenter from a scanned or typed Delegate Card code. */
export async function lookupPresenter(raw: string): Promise<LookupResult> {
  const { db, profile } = await requireUser("/judge/scan");
  if (!profile.access.judging && !profile.access.owner) return { ok: false, error: "Your account can't use the judging portal." };
  const scan = parseScan(String(raw ?? "").slice(0, 300));
  if (!scan || scan.kind !== "card") return { ok: false, error: "That isn't an INSPIRE Delegate Card. Scan the QR code on the back of the presenter's card." };
  const { data, error } = await db.rpc("judging_lookup", { code: scan.code });
  if (error) return { ok: false, error: "We couldn't look that card up. Check your connection and try again." };
  const res = data as { state: string; presenter_id?: string; full_name?: string | null; kinds?: string[] };
  if (res.state === "ok" && res.presenter_id) {
    const kinds = (res.kinds ?? []).filter(isKind);
    if (res.presenter_id === profile.id) return { ok: false, error: "That's your own card. You can't mark your own presentation." };
    return { ok: true, presenterId: res.presenter_id, name: res.full_name ?? null, kinds };
  }
  if (res.state === "not_presenter") return { ok: false, error: `${res.full_name ?? "This person"} isn't presenting a talk or poster, so there's nothing to mark.` };
  if (res.state === "not_allowed") return { ok: false, error: "Your account can't use the judging portal." };
  return { ok: false, error: "We don't recognise that card. Ask the presenter to open their Delegate Card in My Hub and try again." };
}
