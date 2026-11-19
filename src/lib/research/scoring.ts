import { ACCESS_ITEMS, ACTIONS, CRAI12, LITERACY_ITEMS, type Answers, type Stage } from "@/lib/research/instrument";

/** Correct answers to the five literacy questions. */
export const LITERACY_KEY: Record<string, string> = { lit_01: "b", lit_02: "b", lit_03: "c", lit_04: "c", lit_05: "b" };

export type ExperienceLevel = "none" | "some" | "presented_or_published";

export type Scores = {
  /** Primary outcome: mean of the 12 CRAI-12 items, 0 to 10. */
  crai_mean: number | null;
  se_global: number | null;
  se_global_then: number | null;
  career_interest: number | null;
  /** Mean of the five access items, 1 to 5. */
  access_mean: number | null;
  /** Mean intention over the six actions, 1 to 5. */
  intent_mean: number | null;
  /** Number of the six actions rated likely or very likely. */
  intent_likely_count: number | null;
  /** Correct answers out of 5 ("I don't know" counts as not correct). */
  literacy_score: number | null;
  /** Any of the six research actions in the 8-week window. */
  actions_any: number | null;
  /** How many of the six actions, 0 to 6. */
  actions_count: number | null;
  barriers_count: number | null;
};

const num = (v: unknown) => (typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

function mean(values: (number | null)[]): number | null {
  if (values.some((v) => v === null) || values.length === 0) return null;
  const s = (values as number[]).reduce((a, b) => a + b, 0);
  return Math.round((s / values.length) * 1000) / 1000;
}

/** Scores for one questionnaire. Scales need every item answered (the questionnaire requires them), so a partial scale scores as missing. */
export function scoreStage(stage: Stage, a: Answers): Scores {
  const crai = mean(CRAI12.map((q) => num(a[q.id])));
  const access = mean(ACCESS_ITEMS.map((q) => num(a[q.id])));
  const asksIntent = stage !== "followup";
  const intents = ACTIONS.map((x) => num(a[`int_${x.id}`]));
  const asksActions = stage !== "post";
  const acts = ACTIONS.map((x) => a[`beh_${x.id}`]);
  const actsKnown = acts.every((v) => v === "yes" || v === "no");
  const asksLiteracy = stage !== "followup";
  const lit = LITERACY_ITEMS.map((q) => a[q.id]);
  const barriers = a.barriers;
  return {
    crai_mean: crai,
    se_global: num(a.se_global),
    se_global_then: stage === "post" ? num(a.se_global_then) : null,
    career_interest: num(a.career_interest),
    access_mean: access,
    intent_mean: asksIntent ? mean(intents) : null,
    intent_likely_count: asksIntent && intents.every((v) => v !== null) ? intents.filter((v) => (v as number) >= 4).length : null,
    literacy_score: asksLiteracy && lit.every((v) => typeof v === "string") ? LITERACY_ITEMS.filter((q) => a[q.id] === LITERACY_KEY[q.id]).length : null,
    actions_any: asksActions && actsKnown ? (acts.includes("yes") ? 1 : 0) : null,
    actions_count: asksActions && actsKnown ? acts.filter((v) => v === "yes").length : null,
    barriers_count: Array.isArray(barriers) ? barriers.filter((b) => b !== "none").length : null,
  };
}

/**
 * Prior research experience, from the baseline question: none; some
 * (a project, audit or review); or has presented or published. This is the
 * prespecified grouping for the "who benefits" analysis.
 */
export function experienceLevel(a: Answers): ExperienceLevel | null {
  const v = a.experience;
  if (!Array.isArray(v) || !v.length) return null;
  if (v.includes("presented") || v.includes("published")) return "presented_or_published";
  if (v.includes("project") || v.includes("audit") || v.includes("review")) return "some";
  return "none";
}

export const SCORE_LABEL: Record<keyof Scores, string> = {
  crai_mean: "CRAI-12 mean (0-10). PRIMARY OUTCOME",
  se_global: "Overall research confidence (0-10)",
  se_global_then: "Retrospective overall confidence before the conference (0-10), post only",
  career_interest: "Interest in research in future career (0-10)",
  access_mean: "Perceived access to research opportunities, mean of 5 items (1-5)",
  intent_mean: "Intention to do the six research actions in the next 8 weeks, mean (1-5)",
  intent_likely_count: "Number of the six actions rated likely or very likely (0-6)",
  literacy_score: "Research literacy check, correct answers (0-5)",
  actions_any: "Did any of the six research actions in the 8-week window (1 = yes)",
  actions_count: "Number of the six research actions done in the 8-week window (0-6)",
  barriers_count: "Number of current barriers chosen (0-10)",
};
