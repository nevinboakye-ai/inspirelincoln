import { ACCESS_ITEMS, ACTIONS, CRAI12, type Answers, type Stage } from "@/lib/research/instrument";

export type ExperienceLevel = "none" | "some" | "presented_or_published";

export type Scores = {
  /** Primary outcome: mean of the 12 CRAI-12 items, 0 to 10. */
  crai_mean: number | null;
  career_interest: number | null;
  /** Mean of the five access items, 1 to 5. */
  access_mean: number | null;
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
  const asksActions = stage !== "post";
  const acts = ACTIONS.map((x) => a[`beh_${x.id}`]);
  const actsKnown = acts.every((v) => v === "yes" || v === "no");
  const barriers = a.barriers;
  return {
    crai_mean: crai,
    career_interest: num(a.career_interest),
    access_mean: access,
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
  career_interest: "Interest in research in future career (0-10)",
  access_mean: "Perceived access to research opportunities, mean of 5 items (1-5)",
  actions_any: "Did any of the six research actions in the 8-week window (1 = yes)",
  actions_count: "Number of the six research actions done in the 8-week window (0-6)",
  barriers_count: "Number of current barriers chosen (0-10)",
};
