import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signAvatars } from "@/lib/avatar";
import { JUDGING_KINDS, toBoardEntry, toCriterion, type BoardEntry, type Criterion, type CriterionRow, type JudgingKind, type Mark } from "@/lib/judging";

export type JudgingSettings = {
  editionId: string | null;
  open: boolean;
  released: boolean;
  releaseScores: boolean;
  releaseNames: boolean;
  releasedAt: string | null;
};

const DEFAULT_SETTINGS: JudgingSettings = { editionId: null, open: true, released: false, releaseScores: true, releaseNames: false, releasedAt: null };

/** Whether the judging migration has been run (the tables exist). */
export function judgingMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST202" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "")));
}

/**
 * Everything the judging portal needs, in one round of parallel requests.
 * Cached per request, so the layout and page share it.
 */
export const loadJudging = cache(async (db: SupabaseClient, me: string, opts: { avatars?: boolean } = {}) => {
  const [board, criteria, settings, panel] = await Promise.all([
    db.rpc("judging_board"),
    db.from("judging_criteria").select("id, kind, label, description, max_score, sort, edition_id, editions!inner(is_current)").eq("editions.is_current", true).order("sort"),
    db.from("judging_settings").select("edition_id, open, released, release_scores, release_names, released_at, editions!inner(is_current)").eq("editions.is_current", true).maybeSingle(),
    db.from("judging_panel").select("kinds").eq("judge_id", me).maybeSingle(),
  ]);
  const missing = judgingMissing(board.error) || judgingMissing(criteria.error);
  const entries: BoardEntry[] = ((board.data ?? []) as Parameters<typeof toBoardEntry>[0][]).map(toBoardEntry);
  if (opts.avatars) {
    const urls = await signAvatars(db, entries.map((e) => e.avatarPath));
    for (const e of entries) e.avatarUrl = e.avatarPath ? (urls.get(e.avatarPath) ?? null) : null;
  }
  const s = settings.data as { edition_id: string; open: boolean; released: boolean; release_scores: boolean; release_names: boolean; released_at: string | null } | null;
  const kinds = ((panel.data?.kinds as string[] | undefined) ?? JUDGING_KINDS).filter((k): k is JudgingKind => k === "oral" || k === "poster");
  return {
    missing,
    failed: Boolean(board.error) && !missing,
    entries,
    criteria: ((criteria.data ?? []) as CriterionRow[]).map(toCriterion),
    settings: s
      ? { editionId: s.edition_id, open: s.open, released: s.released, releaseScores: s.release_scores, releaseNames: s.release_names, releasedAt: s.released_at }
      : DEFAULT_SETTINGS,
    kinds: kinds.length ? kinds : JUDGING_KINDS,
  };
});

export type MarkRow = {
  id: string;
  judge_id: string | null;
  judge_name: string;
  presenter_id: string;
  kind: string;
  scores: Record<string, number> | null;
  total: number;
  max_total: number;
  strengths: string;
  improvements: string;
  committee_note: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
};

export const MARK_COLUMNS = "id, judge_id, judge_name, presenter_id, kind, scores, total, max_total, strengths, improvements, committee_note, status, submitted_at, updated_at";

export const toMark = (r: MarkRow): Mark => ({
  id: r.id,
  judgeId: r.judge_id,
  judgeName: r.judge_name || "Judge",
  presenterId: r.presenter_id,
  kind: r.kind === "oral" ? "oral" : "poster",
  scores: r.scores ?? {},
  total: r.total,
  maxTotal: r.max_total,
  strengths: r.strengths,
  improvements: r.improvements,
  committeeNote: r.committee_note,
  status: r.status === "submitted" ? "submitted" : "draft",
  submittedAt: r.submitted_at,
  updatedAt: r.updated_at,
});

/** Every mark for the current conference (the committee with manage_judging only; RLS returns a judge's own otherwise). */
export async function loadMarks(db: SupabaseClient, editionId: string | null) {
  if (!editionId) return [] as Mark[];
  const { data } = await db.from("judging_marks").select(MARK_COLUMNS).eq("edition_id", editionId).order("updated_at", { ascending: false });
  return ((data ?? []) as MarkRow[]).map(toMark);
}

export type { Criterion };
