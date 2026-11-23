import { z } from "zod";

/**
 * The post-conference feedback form. Everything here is shared by the form,
 * the server check and the committee's summary, so the words people tap are
 * exactly the words the committee reads back.
 *
 * Kept deliberately short: one tap for the overall rating, optional 1 to 5
 * sliders for each part of the day, the workshop(s) they went to (scoring
 * the workshop and the doctor who led it), two sets of tap-to-pick phrases
 * (with room to write more), how likely they are to recommend INSPIRE, and
 * whether they'd like help doing their own research.
 */

export const OVERALL = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very good" },
  { value: 5, label: "Excellent" },
] as const;

/** The 1 to 5 scale used for each part of the day and for workshops. */
export const SCALE = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very good" },
  { value: 5, label: "Excellent" },
] as const;
export const scaleLabel = (v: number) => SCALE.find((s) => s.value === v)?.label ?? "";

/** Answers from the first version of the form (great / OK / poor) read as 5 / 3 / 1. */
const LEGACY: Record<string, number> = { great: 5, ok: 3, poor: 1 };
export function partScore(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) return v;
  if (typeof v === "string" && v in LEGACY) return LEGACY[v];
  return null;
}

/** The last question: would they like to do their own research with INSPIRE's support? */
export const RESEARCH_INTEREST = [
  { value: "yes", label: "Yes, I'd love to" },
  { value: "maybe", label: "Maybe, tell me more" },
  { value: "no", label: "Not right now" },
] as const;
export type ResearchInterest = (typeof RESEARCH_INTEREST)[number]["value"];

/** At most this many workshops can be rated (there are only a few slots in a day). */
export const MAX_WORKSHOPS = 6;

export type Part = { id: string; label: string; presentersOnly?: boolean };
export const PARTS: Part[] = [
  { id: "keynotes", label: "Keynote talks" },
  { id: "workshops", label: "Workshops" },
  { id: "orals", label: "Oral presentations" },
  { id: "posters", label: "Poster session" },
  { id: "networking", label: "Networking and breaks" },
  { id: "organisation", label: "Organisation on the day" },
  { id: "venue", label: "Venue and food" },
  { id: "presenting", label: "Presenting your own work", presentersOnly: true },
];

export type Phrase = { id: string; label: string };
export const HIGHLIGHTS: Phrase[] = [
  { id: "keynotes", label: "Inspiring keynotes" },
  { id: "workshops", label: "Hands-on workshops" },
  { id: "people", label: "Meeting new people" },
  { id: "others_research", label: "Seeing others' research" },
  { id: "presenting", label: "Presenting my research" },
  { id: "digital_health", label: "Learning about digital health" },
  { id: "careers", label: "Career ideas" },
  { id: "atmosphere", label: "Friendly atmosphere" },
  { id: "organised", label: "Well organised" },
  { id: "prizes", label: "Prizes and recognition" },
  { id: "venue", label: "The venue" },
  { id: "food", label: "Food and refreshments" },
];

/** "Nothing, it was great" can't be picked alongside anything else. */
export const IMPROVE_NOTHING = "nothing";
export const IMPROVEMENTS: Phrase[] = [
  { id: "timing", label: "Keep to time" },
  { id: "networking", label: "More time to network" },
  { id: "qa", label: "More time for questions" },
  { id: "signage", label: "Clearer signs around campus" },
  { id: "hands_on", label: "More hands-on sessions" },
  { id: "info_sooner", label: "Information sooner" },
  { id: "food", label: "Better food options" },
  { id: "sound", label: "Better sound or screens" },
  { id: "breaks", label: "Longer breaks" },
  { id: "topics", label: "A wider range of topics" },
  { id: "presenter_info", label: "Clearer presenter instructions" },
  { id: IMPROVE_NOTHING, label: "Nothing, it was great" },
];

export const NOTE_MAX = 1000;

const note = z
  .string()
  .trim()
  .max(NOTE_MAX, `Keep each comment to ${NOTE_MAX} characters.`)
  .optional()
  .transform((v) => (v ? v : null));

const score = z.coerce.number().int().min(1).max(5);

const workshopAnswer = z.object({
  id: z.uuid(),
  workshop: score.nullable().optional().transform((v) => v ?? null),
  lead: score.nullable().optional().transform((v) => v ?? null),
  note,
});
export type WorkshopAnswer = z.output<typeof workshopAnswer>;

const ids = (list: Phrase[]) => z.array(z.enum(list.map((p) => p.id) as [string, ...string[]])).max(list.length);

export const feedbackSchema = z
  .object({
    overall: z.coerce.number().int().min(1, "Choose a rating for the day.").max(5),
    parts: z.partialRecord(z.enum(PARTS.map((p) => p.id) as [string, ...string[]]), score).default({}),
    workshops: z.array(workshopAnswer).max(MAX_WORKSHOPS).default([]),
    highlights: ids(HIGHLIGHTS).default([]),
    highlightNote: note,
    improvements: ids(IMPROVEMENTS).default([]),
    improveNote: note,
    recommend: z.coerce.number().int().min(0, "Choose a number from 0 to 10.").max(10, "Choose a number from 0 to 10."),
    comments: note,
    quoteOk: z.boolean().default(false),
    research: z.enum(["yes", "maybe", "no"]).nullable().optional().transform((v) => v ?? null),
    researchContact: z.boolean().default(false),
  })
  .transform((v) => ({
    ...v,
    highlights: [...new Set(v.highlights)],
    // Each workshop once.
    workshops: v.workshops.filter((w, i, all) => all.findIndex((x) => x.id === w.id) === i),
    // Only someone who said yes or maybe can ask to be contacted.
    researchContact: v.researchContact && (v.research === "yes" || v.research === "maybe"),
    // "Nothing, it was great" on its own, or not at all.
    improvements: v.improvements.includes(IMPROVE_NOTHING) && v.improvements.length > 1 ? [...new Set(v.improvements.filter((x) => x !== IMPROVE_NOTHING))] : [...new Set(v.improvements)],
  }));

export type FeedbackInput = z.input<typeof feedbackSchema>;
export type Feedback = z.output<typeof feedbackSchema>;

/** The parts someone is asked to rate: "Presenting your own work" only for presenters. */
export function partsFor(presenter: boolean) {
  return PARTS.filter((p) => presenter || !p.presentersOnly);
}

/** Net Promoter Score from 0 to 10 answers: % promoters (9 or 10) minus % detractors (0 to 6). */
export function netPromoter(scores: number[]) {
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export const labelOf = (list: Phrase[], id: string) => list.find((p) => p.id === id)?.label ?? id;

/** One answer as the committee sees it: no name, no account id. */
export type FeedbackRow = {
  roles: string[];
  overall: number;
  recommend: number;
  /** 1 to 5, or great / ok / poor from the first version of the form. */
  parts: Record<string, number | string>;
  workshops?: { id: string; workshop?: number; lead?: number; note?: string }[];
  research?: ResearchInterest | null;
  highlights: string[];
  highlight_note: string | null;
  improvements: string[];
  improve_note: string | null;
  comments: string | null;
  quote_ok: boolean;
  day: string;
};

const PRESENTING = ["oral_presenter", "poster_presenter"];
const ATTENDING = ["delegate", "oral_waitlist", ...PRESENTING];

/** Who answered, in one word, for splitting the results. */
export function groupOf(roles: string[]): "Presenter" | "Delegate" | "Committee or staff" {
  if (roles.some((r) => PRESENTING.includes(r))) return "Presenter";
  if (roles.some((r) => ATTENDING.includes(r))) return "Delegate";
  return "Committee or staff";
}

/** Everything the committee's feedback page shows, worked out from the answers. */
export type FeedbackWorkshop = { id: string; number: number; title: string; facilitator: string | null };

const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const spread = (xs: number[]) => SCALE.map((s) => ({ value: s.value, n: xs.filter((x) => x === s.value).length }));

export function summarise(rows: FeedbackRow[], workshops: FeedbackWorkshop[] = []) {
  const count = (list: Phrase[], pick: (r: FeedbackRow) => string[]) =>
    list
      .map((p) => ({ id: p.id, label: p.label, n: rows.filter((r) => pick(r).includes(p.id)).length }))
      .sort((a, b) => b.n - a.n);
  const avg = rows.length ? rows.reduce((s, r) => s + r.overall, 0) / rows.length : null;
  return {
    responses: rows.length,
    overallAverage: avg === null ? null : Math.round(avg * 10) / 10,
    overall: OVERALL.map((o) => ({ ...o, n: rows.filter((r) => r.overall === o.value).length })),
    nps: netPromoter(rows.map((r) => r.recommend)),
    recommend: Array.from({ length: 11 }, (_, v) => ({ value: v, n: rows.filter((r) => r.recommend === v).length })),
    parts: PARTS.map((p) => {
      const rated = rows.map((r) => partScore(r.parts?.[p.id])).filter((x): x is number => x !== null);
      return { id: p.id, label: p.label, average: mean(rated), spread: spread(rated), n: rated.length };
    }).filter((p) => p.n > 0 || !PARTS.find((x) => x.id === p.id)?.presentersOnly),
    workshops: workshops.map((w) => {
      const answers = rows.flatMap((r) => (r.workshops ?? []).filter((a) => a.id === w.id));
      const ws = answers.map((a) => partScore(a.workshop)).filter((x): x is number => x !== null);
      const lead = answers.map((a) => partScore(a.lead)).filter((x): x is number => x !== null);
      return {
        ...w,
        went: answers.length,
        workshop: { average: mean(ws), spread: spread(ws), n: ws.length },
        lead: { average: mean(lead), spread: spread(lead), n: lead.length },
        notes: answers.map((a) => a.note).filter((x): x is string => Boolean(x)),
      };
    }),
    research: RESEARCH_INTEREST.map((o) => ({ ...o, n: rows.filter((r) => r.research === o.value).length })),
    highlights: count(HIGHLIGHTS, (r) => r.highlights ?? []),
    improvements: count(IMPROVEMENTS, (r) => r.improvements ?? []),
    groups: (["Delegate", "Presenter", "Committee or staff"] as const).map((g) => {
      const mine = rows.filter((r) => groupOf(r.roles ?? []) === g);
      return { group: g, n: mine.length, overallAverage: mine.length ? Math.round((mine.reduce((s, r) => s + r.overall, 0) / mine.length) * 10) / 10 : null };
    }),
    comments: rows
      .flatMap((r) => [
        r.highlight_note && { kind: "Best bits" as const, text: r.highlight_note, quoteOk: r.quote_ok, group: groupOf(r.roles ?? []), overall: r.overall },
        r.improve_note && { kind: "To change" as const, text: r.improve_note, quoteOk: r.quote_ok, group: groupOf(r.roles ?? []), overall: r.overall },
        r.comments && { kind: "Anything else" as const, text: r.comments, quoteOk: r.quote_ok, group: groupOf(r.roles ?? []), overall: r.overall },
      ])
      .filter((c): c is Exclude<typeof c, null | "" | undefined> => Boolean(c)),
  };
}
