import "server-only";
import { cache } from "react";
import type { Profile, requireUser } from "@/lib/auth";
import { STAGES, type Stage } from "@/lib/research/instrument";
import { DEFAULT_SETTINGS, canEnrol, dueStage, nextStage, settingsFromRow, type StudySettings } from "@/lib/research/schedule";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["db"];

/** Set when someone chooses "Ask me later", so the invitation waits until their next visit. */
export const RESEARCH_LATER_COOKIE = "inspire_research_later";

export type MyResearch = {
  /** False until setup file 50 has run. */
  ready: boolean;
  settings: StudySettings;
  eligible: boolean;
  decision: "consented" | "declined" | null;
  code: string | null;
  consent: { contact: boolean; linkage: boolean; sharing: boolean };
  withdrawn: boolean;
  withdrawal: "no_further" | "delete" | null;
  done: Stage[];
  /** May join now (first questionnaire still open). */
  canJoin: boolean;
  /** The questionnaire to do now, if any. */
  due: Stage | null;
  next: { stage: Stage; opens: string } | null;
  /** The research team (or site owner) can preview everything while the study is off. */
  canPreview: boolean;
};

export const getStudySettings = cache(async (db: SupabaseClient): Promise<{ ready: boolean; settings: StudySettings }> => {
  const { data, error } = await db.from("research_study").select("*").eq("id", 1).maybeSingle();
  if (error) return { ready: false, settings: DEFAULT_SETTINGS };
  return { ready: true, settings: settingsFromRow(data) };
});

/** Where the signed-in person stands in the study. */
export const getMyResearch = cache(async (db: SupabaseClient, profile: Profile): Promise<MyResearch> => {
  const { ready, settings } = await getStudySettings(db);
  const canPreview = profile.access.owner || profile.access.can.research_data;
  const empty: MyResearch = {
    ready,
    settings,
    eligible: false,
    decision: null,
    code: null,
    consent: { contact: false, linkage: false, sharing: false },
    withdrawn: false,
    withdrawal: null,
    done: [],
    canJoin: false,
    due: null,
    next: null,
    canPreview,
  };
  if (!ready || !settings.enabled) return empty;
  const { data, error } = await db.rpc("research_my_status");
  if (error || !data) return empty;
  const s = data as Record<string, unknown>;
  const done = (Array.isArray(s.done) ? s.done : []).filter((x): x is Stage => STAGES.includes(x as Stage));
  const decision = s.decision === "consented" || s.decision === "declined" ? s.decision : null;
  const withdrawn = Boolean(s.withdrawn_at);
  const active = decision === "consented" && !withdrawn;
  return {
    ...empty,
    eligible: s.eligible === true,
    decision,
    code: typeof s.code === "string" ? s.code : null,
    consent: { contact: s.consent_contact === true, linkage: s.consent_linkage === true, sharing: s.consent_sharing === true },
    withdrawn,
    withdrawal: s.withdrawal === "delete" || s.withdrawal === "no_further" ? s.withdrawal : null,
    done,
    canJoin: s.eligible === true && decision !== "consented" && !withdrawn && canEnrol(settings),
    // After the first questionnaire, the later ones need it done first.
    due: active ? (done.includes("pre") || canEnrol(settings) ? dueStage(settings, done) : null) : null,
    next: active && done.includes("pre") ? nextStage(settings, done) : null,
  };
});

/** Whether to put the invitation in front of someone: eligible, study open to new people, and they haven't answered. */
export function needsDecision(r: MyResearch) {
  return r.eligible && r.decision === null && !r.withdrawn && r.canJoin;
}
