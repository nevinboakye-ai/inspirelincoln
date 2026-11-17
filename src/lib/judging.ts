/**
 * Judging on the day: types and the pure helpers shared by the judging
 * portal (/judge), the committee's results page and the presenter's
 * feedback. The database checks every rule again (supabase/migrations/
 * 20261211000100_judging.sql); nothing here grants access.
 */

export type JudgingKind = "oral" | "poster";
export const JUDGING_KINDS: JudgingKind[] = ["oral", "poster"];

export const KIND_LABEL: Record<JudgingKind, { one: string; many: string; file: string; short: string }> = {
  oral: { one: "Oral presentation", many: "Oral presentations", file: "slides", short: "Oral" },
  poster: { one: "Poster", many: "Posters", file: "poster", short: "Poster" },
};

export const isKind = (v: unknown): v is JudgingKind => v === "oral" || v === "poster";

/**
 * A presenter's marking is complete once at least this many judges have
 * submitted marks and feedback. More judges can still mark them after that,
 * until the committee closes marking for them (or for everyone). Only
 * presenters with complete marking are ranked for prizes, and presenters
 * only see released feedback once their marking is complete. The database
 * uses the same number (supabase/migrations/20261215000000_two_judge_minimum.sql).
 */
export const MIN_JUDGES = 2;

/** "1 of 2 judges", or "3 judges" once the minimum is reached. */
export function judgesLabel(n: number, min = MIN_JUDGES) {
  return n >= min ? `${n} judge${n === 1 ? "" : "s"}` : `${n} of ${min} judges`;
}

export const isComplete = (n: number, min = MIN_JUDGES) => n >= min;

export type Criterion = { id: string; kind: JudgingKind; label: string; description: string; maxScore: number; sort: number };

/** One row of public.judging_board(): a presenter and the kind of presentation. */
export type BoardEntry = {
  presenterId: string;
  kind: JudgingKind;
  name: string;
  institution: string | null;
  title: string | null;
  avatarPath: string | null;
  avatarUrl?: string | null;
  /** Where to find them, for example "Board 12". */
  label: string | null;
  sort: number;
  /** Their answer to "Will you be there to present?" */
  attendance: "confirmed" | "unavailable" | null;
  checkedIn: boolean;
  submission: { id: string; path: string; name: string; type: string; uploadedAt: string } | null;
  /** The committee asked this judge to mark them. */
  assigned: boolean;
  myStatus: "draft" | "submitted" | null;
  myTotal: number | null;
  myMax: number | null;
  /** Submitted marks from every judge. */
  marksIn: number;
  /** The committee has closed marking for this presenter, so no more marks can be added or changed. */
  closed: boolean;
};

type BoardRow = {
  presenter_id: string;
  kind: string;
  full_name: string | null;
  institution: string | null;
  title: string | null;
  avatar_path: string | null;
  label: string | null;
  sort: number | null;
  attendance: string | null;
  checked_in: boolean | null;
  submission_id: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  uploaded_at: string | null;
  assigned: boolean | null;
  my_status: string | null;
  my_total: number | null;
  my_max: number | null;
  marks_in: number | null;
  /** Missing until the two-judge migration is run. */
  marking_closed?: boolean | null;
};

export function toBoardEntry(r: BoardRow): BoardEntry {
  return {
    presenterId: r.presenter_id,
    kind: r.kind === "oral" ? "oral" : "poster",
    name: r.full_name?.trim() || "Name not given",
    institution: r.institution,
    title: r.title,
    avatarPath: r.avatar_path,
    label: r.label,
    sort: r.sort ?? 0,
    attendance: r.attendance === "confirmed" || r.attendance === "unavailable" ? r.attendance : null,
    checkedIn: Boolean(r.checked_in),
    submission:
      r.submission_id && r.file_path
        ? { id: r.submission_id, path: r.file_path, name: r.file_name ?? "File", type: r.file_type ?? "", uploadedAt: r.uploaded_at ?? "" }
        : null,
    assigned: Boolean(r.assigned),
    myStatus: r.my_status === "draft" || r.my_status === "submitted" ? r.my_status : null,
    myTotal: r.my_total,
    myMax: r.my_max,
    marksIn: r.marks_in ?? 0,
    closed: Boolean(r.marking_closed),
  };
}

export type CriterionRow = { id: string; kind: string; label: string; description: string | null; max_score: number; sort: number | null };
export const toCriterion = (c: CriterionRow): Criterion => ({
  id: c.id,
  kind: c.kind === "oral" ? "oral" : "poster",
  label: c.label,
  description: c.description ?? "",
  maxScore: c.max_score,
  sort: c.sort ?? 0,
});

/**
 * Which presentations a judge works through: the kinds they judge, without
 * their own, and only their assigned presenters if the committee has
 * assigned any for that kind.
 */
export function judgeQueue(entries: BoardEntry[], opts: { me: string; kinds: JudgingKind[] }) {
  const mine = entries.filter((e) => e.presenterId !== opts.me && opts.kinds.includes(e.kind));
  const assignedKinds = new Set(mine.filter((e) => e.assigned).map((e) => e.kind));
  return mine.filter((e) => !assignedKinds.has(e.kind) || e.assigned);
}

/** "Dr Patel" for "Dr Asha Patel", otherwise the first name. */
export function greetingName(full: string | null | undefined) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  if (/^(dr|prof|professor|mr|mrs|ms|miss|mx)\.?$/i.test(parts[0]) && parts.length > 1) return `${parts[0]} ${parts[parts.length - 1]}`;
  return parts[0];
}

/** Nothing left for this judge to do: they've submitted, or the committee has closed marking for this presenter. */
export const isDone = (e: Pick<BoardEntry, "myStatus" | "closed">) => e.myStatus === "submitted" || e.closed;

/** The next presentation still to mark after this one, wrapping round to the start. */
export function nextToMark(queue: BoardEntry[], current: { presenterId: string; kind: JudgingKind }) {
  const sameKind = queue.filter((e) => e.kind === current.kind);
  const others = queue.filter((e) => e.kind !== current.kind);
  const i = sameKind.findIndex((e) => e.presenterId === current.presenterId);
  const ordered = [...sameKind.slice(i + 1), ...sameKind.slice(0, Math.max(i, 0)), ...others];
  return ordered.find((e) => !isDone(e) && !(e.presenterId === current.presenterId && e.kind === current.kind)) ?? null;
}

/** A mark as the committee sees it. */
export type Mark = {
  id: string;
  judgeId: string | null;
  judgeName: string;
  presenterId: string;
  kind: JudgingKind;
  scores: Record<string, number>;
  total: number;
  maxTotal: number;
  strengths: string;
  improvements: string;
  committeeNote: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
  updatedAt: string;
};

/**
 * A mark as a percentage, worked out from the current criteria so results
 * stay fair if the committee changes the criteria after some marking.
 * Criteria the judge didn't score are left out of both sides.
 */
export function markPercent(m: Pick<Mark, "scores" | "total" | "maxTotal">, criteria: Pick<Criterion, "id" | "maxScore">[]) {
  let got = 0;
  let max = 0;
  for (const c of criteria) {
    const v = m.scores[c.id];
    if (typeof v === "number") {
      got += v;
      max += c.maxScore;
    }
  }
  if (max === 0) return m.maxTotal > 0 ? (m.total / m.maxTotal) * 100 : null;
  return (got / max) * 100;
}

export type ResultRow = {
  presenterId: string;
  kind: JudgingKind;
  /** Average of the submitted marks, as a percentage (null with no marks). */
  average: number | null;
  /** Average score per criterion id. */
  perCriterion: Record<string, number>;
  marks: Mark[];
  submitted: number;
  drafts: number;
  /** At least MIN_JUDGES judges have submitted marks, so the presenter counts for results and prizes. */
  complete: boolean;
  /** 1 for the highest average among presenters with complete marking; equal averages share a rank. Null until marking is complete. */
  rank: number | null;
  /** The gap between the highest and lowest mark, in percentage points, to spot judges who disagree. */
  spread: number | null;
};

/**
 * Ranks presenters of one kind by their average mark. Only presenters with
 * complete marking (at least `minJudges` submitted marks) get a rank; the
 * rest follow, unranked, with their provisional average.
 */
export function rankResults(
  entries: Pick<BoardEntry, "presenterId" | "kind">[],
  marks: Mark[],
  criteria: Criterion[],
  kind: JudgingKind,
  minJudges = MIN_JUDGES,
): ResultRow[] {
  const crit = criteria.filter((c) => c.kind === kind);
  const rows: ResultRow[] = entries
    .filter((e) => e.kind === kind)
    .map((e) => {
      const mine = marks.filter((m) => m.presenterId === e.presenterId && m.kind === kind);
      const done = mine.filter((m) => m.status === "submitted");
      const pcts = done.map((m) => markPercent(m, crit)).filter((p): p is number => p !== null);
      const perCriterion: Record<string, number> = {};
      for (const c of crit) {
        const vals = done.map((m) => m.scores[c.id]).filter((v): v is number => typeof v === "number");
        if (vals.length) perCriterion[c.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
      return {
        presenterId: e.presenterId,
        kind,
        average: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
        perCriterion,
        marks: mine,
        submitted: done.length,
        drafts: mine.length - done.length,
        complete: isComplete(done.length, minJudges),
        rank: null,
        spread: pcts.length > 1 ? Math.max(...pcts) - Math.min(...pcts) : null,
      };
    });
  rows.sort((a, b) => Number(b.complete) - Number(a.complete) || (b.average ?? -1) - (a.average ?? -1) || b.submitted - a.submitted);
  let rank = 0;
  let prev: number | null = null;
  rows.forEach((r, i) => {
    if (r.average === null || !r.complete) return;
    const rounded = Math.round(r.average * 10) / 10;
    if (prev === null || rounded !== prev) rank = i + 1;
    prev = rounded;
    r.rank = rank;
  });
  return rows;
}

/** Plain-English messages for the database's judging errors. */
export function judgingError(message: string | undefined | null) {
  const m = message ?? "";
  if (m.includes("MARKING_CLOSED")) return "The committee has closed marking for this presenter, so marks can't be added or changed now.";
  if (m.includes("JUDGING_CLOSED")) return "Judging has been closed by the committee, so marks can't be changed now.";
  if (m.includes("INCOMPLETE_SCORES")) return "Give a mark for every criterion before submitting.";
  if (m.includes("INCOMPLETE_FEEDBACK")) return "Write what went well and what to improve before submitting.";
  if (m.includes("BAD_SCORE")) return "One of the marks is out of range. Check them and try again.";
  if (m.includes("OWN_PRESENTATION")) return "You can't mark your own presentation.";
  if (m.includes("NOT_PRESENTER")) return "This person isn't presenting this kind of presentation.";
  if (m.includes("NO_CRITERIA")) return "The committee hasn't set the marking criteria yet.";
  if (m.includes("NOT_ALLOWED")) return "Your account can't mark presentations. Ask the committee to check your judge account.";
  if (m.includes("NO_EVENT")) return "There's no current conference to mark.";
  return "Your marks couldn't be saved. Check your connection and try again.";
}

/** The feedback a presenter sees once it is released (public.my_judging_feedback). */
export type ReleasedFeedback = {
  released: boolean;
  released_at?: string | null;
  show_scores?: boolean;
  show_names?: boolean;
  items?: {
    kind: JudgingKind;
    judge: string | null;
    total: number | null;
    max_total: number | null;
    scores: { label: string; score: number; max: number }[] | null;
    strengths: string;
    improvements: string;
    submitted_at: string | null;
  }[];
};

export type PreviewKind = "image" | "pdf" | "office" | null;

/**
 * How a submitted file can be shown in the page rather than downloaded:
 * images and PDFs are drawn in the browser, PowerPoint goes through the
 * Office viewer, and anything else (Keynote) can only be downloaded. Some
 * browsers upload without a type, so the file name's extension decides then.
 */
export function previewKind(type: string, name = ""): PreviewKind {
  const t = type.toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (t.startsWith("image/") || (!t && ["png", "jpg", "jpeg", "webp"].includes(ext))) return "image";
  if (t === "application/pdf" || (!t && ext === "pdf")) return "pdf";
  if (
    t === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    t === "application/vnd.ms-powerpoint" ||
    ((!t || t === "application/octet-stream") && (ext === "pptx" || ext === "ppt"))
  )
    return "office";
  return null;
}
