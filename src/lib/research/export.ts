import { STAGES, STAGE_LABEL, itemsFor, textFor, type Answers, type Stage } from "@/lib/research/instrument";
import { SCORE_LABEL, experienceLevel, scoreStage, type Scores } from "@/lib/research/scoring";

/** One row from public.research_export(): never a name, email or account id. */
export type ExportRow = {
  participant_code: string;
  consent_linkage: boolean;
  consent_sharing: boolean;
  withdrawn: boolean;
  checked_in: boolean | null;
  stage: Stage | null;
  answers: Answers | null;
  instrument_version: string | null;
  submitted_at: string | null;
  started_at: string | null;
};

const SCORE_KEYS = Object.keys(SCORE_LABEL) as (keyof Scores)[];

/** Whole days between the conference and a timestamp (UK dates), so exact submission times never leave the database. */
export function daysFromEvent(eventDate: string, iso: string | null): number | null {
  if (!iso) return null;
  const local = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return Math.round((Date.parse(`${local}T00:00:00Z`) - Date.parse(`${eventDate}T00:00:00Z`)) / 86_400_000);
}

/** Minutes spent on a questionnaire, rounded, or null if unknown or implausible (over 3 hours). */
export function minutesTaken(started: string | null, submitted: string | null): number | null {
  if (!started || !submitted) return null;
  const m = (Date.parse(submitted) - Date.parse(started)) / 60_000;
  return Number.isFinite(m) && m >= 0 && m <= 180 ? Math.round(m * 10) / 10 : null;
}

/** Column names for one stage's answers. Multiple-choice questions become one 0/1 column per option. */
export function answerColumns(stage: Stage): { column: string; item: string; option?: string }[] {
  const p = STAGE_LABEL[stage].prefix;
  return itemsFor(stage).flatMap(({ item }) =>
    item.kind === "multi" ? item.options.map((o) => ({ column: `${p}_${item.id}_${o.value}`, item: item.id, option: o.value })) : [{ column: `${p}_${item.id}`, item: item.id }],
  );
}

function answerCells(stage: Stage, a: Answers | null): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const c of answerColumns(stage)) {
    const v = a?.[c.item];
    if (c.option !== undefined) out[c.column] = a ? (Array.isArray(v) ? (v.includes(c.option) ? 1 : 0) : null) : null;
    else out[c.column] = typeof v === "string" ? (/^-?\d+$/.test(v) ? Number(v) : v) : null;
  }
  return out;
}

const BASELINE = ["discipline", "stage", "university", "university_other", "role", "first_gen", "gender"] as const;

type Participant = { code: string; linkage: boolean; sharing: boolean; withdrawn: boolean; checkedIn: boolean | null; stages: Partial<Record<Stage, ExportRow>> };

function group(rows: ExportRow[]): Participant[] {
  const by = new Map<string, Participant>();
  for (const r of rows) {
    const p = by.get(r.participant_code) ?? { code: r.participant_code, linkage: r.consent_linkage, sharing: r.consent_sharing, withdrawn: r.withdrawn, checkedIn: r.consent_linkage ? r.checked_in : null, stages: {} };
    if (r.stage) p.stages[r.stage] = r;
    by.set(r.participant_code, p);
  }
  return [...by.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function baselineCovariates(p: Participant) {
  const pre = p.stages.pre?.answers ?? null;
  const out: Record<string, string | number | null> = {};
  for (const k of BASELINE) out[k] = typeof pre?.[k] === "string" ? (pre[k] as string) : null;
  out.experience_level = pre ? experienceLevel(pre) : null;
  out.no_prior_experience = out.experience_level ? (out.experience_level === "none" ? 1 : 0) : null;
  out.mentor_pre = typeof pre?.mentor === "string" ? (pre.mentor as string) : null;
  out.no_mentor_pre = out.mentor_pre ? (out.mentor_pre === "yes" ? 0 : 1) : null;
  return out;
}

/** One row per participant: every answer and score at every stage. For SPSS, Stata or a spreadsheet. */
export function buildWide(rows: ExportRow[], eventDate: string): { columns: string[]; rows: Record<string, unknown>[] } {
  const people = group(rows);
  const head = ["participant_code", "consent_linkage", "consent_sharing", "withdrawn_no_further_contact", "checked_in", "stages_completed", "complete_pre_post", "complete_all_three"];
  const base = [...BASELINE, "experience_level", "no_prior_experience", "mentor_pre", "no_mentor_pre"];
  const stageCols = STAGES.flatMap((s) => {
    const p = STAGE_LABEL[s].prefix;
    return [`${p}_done`, `${p}_day`, `${p}_minutes`, `${p}_version`, ...SCORE_KEYS.map((k) => `${p}_${k}`), ...answerColumns(s).map((c) => c.column)];
  });
  const columns = [...head, ...base, ...stageCols];
  const out = people.map((p) => {
    const row: Record<string, unknown> = {
      participant_code: p.code,
      consent_linkage: p.linkage ? 1 : 0,
      consent_sharing: p.sharing ? 1 : 0,
      withdrawn_no_further_contact: p.withdrawn ? 1 : 0,
      checked_in: p.checkedIn === null ? null : p.checkedIn ? 1 : 0,
      stages_completed: STAGES.filter((s) => p.stages[s]).length,
      complete_pre_post: p.stages.pre && p.stages.post ? 1 : 0,
      complete_all_three: p.stages.pre && p.stages.post && p.stages.followup ? 1 : 0,
      ...baselineCovariates(p),
    };
    for (const s of STAGES) {
      const pre = STAGE_LABEL[s].prefix;
      const r = p.stages[s];
      row[`${pre}_done`] = r ? 1 : 0;
      row[`${pre}_day`] = r ? daysFromEvent(eventDate, r.submitted_at) : null;
      row[`${pre}_minutes`] = r ? minutesTaken(r.started_at, r.submitted_at) : null;
      row[`${pre}_version`] = r?.instrument_version ?? null;
      const sc = r?.answers ? scoreStage(s, r.answers) : null;
      for (const k of SCORE_KEYS) row[`${pre}_${k}`] = sc ? sc[k] : null;
      Object.assign(row, answerCells(s, r?.answers ?? null));
    }
    return row;
  });
  return { columns, rows: out };
}

/** One row per participant per questionnaire, with scores and baseline covariates: ready for a mixed model. */
export function buildLong(rows: ExportRow[], eventDate: string): { columns: string[]; rows: Record<string, unknown>[] } {
  const people = group(rows);
  const columns = ["participant_code", "time", "time_index", "day", "checked_in", ...BASELINE, "experience_level", "no_prior_experience", "mentor_pre", "no_mentor_pre", "mentor_now", ...SCORE_KEYS];
  const out: Record<string, unknown>[] = [];
  for (const p of people) {
    const cov = baselineCovariates(p);
    STAGES.forEach((s, i) => {
      const r = p.stages[s];
      if (!r?.answers) return;
      out.push({
        participant_code: p.code,
        time: s,
        time_index: i,
        day: daysFromEvent(eventDate, r.submitted_at),
        checked_in: p.checkedIn === null ? null : p.checkedIn ? 1 : 0,
        ...cov,
        mentor_now: typeof r.answers.mentor === "string" ? r.answers.mentor : null,
        ...scoreStage(s, r.answers),
      });
    });
  }
  return { columns, rows: out };
}

/** What every column means. */
export function buildCodebook(): { columns: string[]; rows: Record<string, unknown>[] } {
  const rows: Record<string, unknown>[] = [
    { variable: "participant_code", stage: "all", type: "id", question: "Random study code. Not linked to any name in the export.", values: "" },
    { variable: "consent_linkage", stage: "all", type: "0/1", question: "Agreed that check-in on the day may be linked to their study code", values: "" },
    { variable: "consent_sharing", stage: "all", type: "0/1", question: "Agreed that fully anonymised answers may be deposited in a data repository", values: "" },
    { variable: "withdrawn_no_further_contact", stage: "all", type: "0/1", question: "Stopped taking part but kept answers already given (people who asked for deletion are not in the data)", values: "" },
    { variable: "checked_in", stage: "all", type: "0/1", question: "Checked in at the conference desk (only where consent_linkage = 1)", values: "" },
    { variable: "experience_level", stage: "pre", type: "category", question: "Derived from pre_experience", values: "none; some (project, audit or review); presented_or_published" },
    { variable: "no_prior_experience", stage: "pre", type: "0/1", question: "Prespecified subgroup: no previous research experience", values: "" },
    { variable: "no_mentor_pre", stage: "pre", type: "0/1", question: "Prespecified subgroup: no research mentor at baseline (No or Not sure)", values: "" },
    { variable: "<stage>_day", stage: "each", type: "integer", question: "Days from the conference (21 November 2026) to submission; negative = before", values: "" },
    { variable: "<stage>_minutes", stage: "each", type: "number", question: "Minutes from opening the questionnaire to submitting (blank if over 3 hours)", values: "" },
  ];
  for (const s of STAGES) {
    const p = STAGE_LABEL[s].prefix;
    for (const k of SCORE_KEYS) rows.push({ variable: `${p}_${k}`, stage: s, type: "score", question: SCORE_LABEL[k], values: "" });
    for (const { section, item } of itemsFor(s)) {
      const q = `${textFor(section.intro ?? "", s) ? `[${textFor(section.intro ?? "", s)}] ` : ""}${textFor(item.text, s)}`;
      if (item.kind === "multi") {
        for (const o of item.options) rows.push({ variable: `${p}_${item.id}_${o.value}`, stage: s, type: "0/1", question: `${q} :: ${o.label}`, values: "1 = chosen, 0 = not chosen" });
      } else if (item.kind === "scale") {
        rows.push({ variable: `${p}_${item.id}`, stage: s, type: "integer", question: q, values: `${item.min} = ${item.minLabel} ... ${item.max} = ${item.maxLabel}` });
      } else if (item.kind === "single") {
        rows.push({ variable: `${p}_${item.id}`, stage: s, type: "category", question: q, values: item.options.map((o) => `${o.value} = ${o.label}`).join("; ") });
      } else {
        rows.push({ variable: `${p}_${item.id}`, stage: s, type: "free text", question: q, values: "Check for identifying details before sharing" });
      }
    }
  }
  return { columns: ["variable", "stage", "type", "question", "values"], rows };
}

/**
 * CSV for statistics software: numbers are written as plain numbers (so a
 * negative day count stays a number), text is quoted and protected against
 * spreadsheet formula injection, and missing values are empty.
 */
export function toAnalysisCsv(table: { columns: string[]; rows: Record<string, unknown>[] }) {
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [table.columns.map(cell).join(","), ...table.rows.map((r) => table.columns.map((c) => cell(r[c])).join(","))].join("\r\n");
}
