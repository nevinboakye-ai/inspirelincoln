import { describe, expect, it } from "vitest";
import { CRAI12, STAGES, STAGE_LABEL, itemsFor, sectionsFor, validateAnswers, type Answers, type Stage } from "@/lib/research/instrument";
import { experienceLevel, scoreStage } from "@/lib/research/scoring";
import { DEFAULT_SETTINGS, canEnrol, dueStage, launchBlockers, nextStage, type StudySettings } from "@/lib/research/schedule";
import { answerColumns, buildCodebook, buildLong, buildWide, daysFromEvent, toAnalysisCsv, type ExportRow } from "@/lib/research/export";

/** A full, valid set of answers for a stage. */
function fill(stage: Stage, overrides: Answers = {}): Answers {
  const a: Answers = {};
  for (const { section, item } of itemsFor(stage)) {
    if (section.when && overrides[section.when.item] && section.when.notIn.includes(overrides[section.when.item] as string)) continue;
    if (item.kind === "scale") a[item.id] = "5";
    else if (item.kind === "single") a[item.id] = item.options[0].value;
    else if (item.kind === "multi") a[item.id] = [item.options[0].value];
    else a[item.id] = "Something";
  }
  return { ...a, ...overrides };
}

describe("research questionnaires", () => {
  it("asks the outcome questions in identical words at every stage that repeats them", () => {
    const words = (s: Stage) => new Map(itemsFor(s).map(({ item }) => [item.id, typeof item.text === "string" ? item.text : item.text[s]]));
    const [pre, post, fu] = STAGES.map(words);
    for (const q of CRAI12) {
      expect(pre.get(q.id)).toBe(q.text);
      expect(post.get(q.id)).toBe(q.text);
      expect(fu.get(q.id)).toBe(q.text);
    }
    for (const id of ["mentor", "barriers", "beh_a1", "beh_a6"]) expect(fu.get(id)).toBe(pre.get(id));
    for (const id of ["career_interest", "acc_01", "acc_05"]) {
      expect(post.get(id)).toBe(pre.get(id));
      expect(fu.get(id)).toBe(pre.get(id));
    }
  });

  it("never asks the same question twice in one questionnaire", () => {
    for (const s of STAGES) {
      const ids = itemsFor(s).map(({ item }) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("keeps each questionnaire to about five minutes", () => {
    // About 7 seconds a question, plus time to read the section introductions.
    for (const s of STAGES) expect(itemsFor(s).length * 7 + sectionsFor(s).length * 8).toBeLessThanOrEqual(STAGE_LABEL[s].minutes * 60 + 30);
    for (const s of STAGES) expect(STAGE_LABEL[s].minutes).toBeLessThanOrEqual(5);
  });

  it("asks baseline details only before", () => {
    expect(sectionsFor("pre").some((s) => s.id === "about")).toBe(true);
    expect(sectionsFor("post").some((s) => s.id === "about")).toBe(false);
  });

  it("accepts a complete set of answers and drops anything unknown", () => {
    const r = validateAnswers("pre", { ...fill("pre"), injected: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.injected).toBeUndefined();
  });

  it("refuses missing, out-of-range and made-up answers", () => {
    const a = fill("pre");
    delete a.se_03;
    expect(validateAnswers("pre", a)).toMatchObject({ ok: false, item: "se_03" });
    expect(validateAnswers("pre", fill("pre", { se_01: "11" }))).toMatchObject({ ok: false, item: "se_01" });
    expect(validateAnswers("pre", fill("pre", { se_01: "4.5" }))).toMatchObject({ ok: false, item: "se_01" });
    expect(validateAnswers("pre", fill("pre", { acc_01: "9" }))).toMatchObject({ ok: false, item: "acc_01" });
    expect(validateAnswers("pre", fill("pre", { experience: ["none", "audit"] }))).toMatchObject({ ok: false, item: "experience" });
    expect(validateAnswers("pre", null)).toMatchObject({ ok: false });
  });

  it("skips the conference-day questions for people who didn't attend", () => {
    const a = fill("post", { attended: "no" });
    const r = validateAnswers("post", { ...a, activities: ["keynotes"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.activities).toBeUndefined();
    const b = fill("post", { attended: "all" });
    delete b.workshops;
    expect(validateAnswers("post", b)).toMatchObject({ ok: false, item: "workshops" });
  });

  it("allows the optional free text to be left blank", () => {
    const a = fill("followup");
    delete a.easier;
    expect(validateAnswers("followup", a).ok).toBe(true);
  });
});

describe("research scoring", () => {
  it("scores the CRAI-12 mean, access and actions", () => {
    const a = fill("pre");
    for (const [i, q] of CRAI12.entries()) a[q.id] = String(i < 6 ? 2 : 4);
    a.beh_a1 = "yes";
    a.beh_a2 = "no";
    const s = scoreStage("pre", a);
    expect(s.crai_mean).toBe(3);
    expect(s.actions_any).toBe(1);
    expect(s.actions_count).toBeGreaterThanOrEqual(1);
    expect(s.access_mean).not.toBeNull();
  });

  it("leaves a scale missing if any item is missing", () => {
    const a = fill("post");
    delete a.se_07;
    expect(scoreStage("post", a).crai_mean).toBeNull();
  });

  it("doesn't score things a stage doesn't ask", () => {
    const f = scoreStage("followup", fill("followup"));
    expect(f.crai_mean).not.toBeNull();
    expect(scoreStage("post", fill("post")).actions_any).toBeNull();
  });

  it("groups prior experience for the prespecified subgroup", () => {
    expect(experienceLevel({ experience: ["none"] })).toBe("none");
    expect(experienceLevel({ experience: ["audit"] })).toBe("some");
    expect(experienceLevel({ experience: ["project", "published"] })).toBe("presented_or_published");
    expect(experienceLevel({})).toBeNull();
  });
});

describe("research schedule", () => {
  const approved: StudySettings = { ...DEFAULT_SETTINGS, enabled: true, ethicsCommittee: "REC", ethicsReference: "R1", ethicsApprovedOn: "2026-11-01", governanceConfirmed: true, leadName: "Dr L", leadEmail: "l@x.test" };

  it("lists what blocks switching on, and nothing once approved", () => {
    expect(launchBlockers(DEFAULT_SETTINGS).length).toBeGreaterThanOrEqual(4);
    expect(launchBlockers(approved)).toEqual([]);
    expect(launchBlockers({ ...approved, postOpensAt: "2026-11-20T00:00:00Z" })).toContain("Put the questionnaire windows in order: before, after, then eight weeks on");
  });

  it("opens each questionnaire in its window", () => {
    expect(dueStage(approved, [], new Date("2026-11-20T12:00:00Z"))).toBe("pre");
    expect(canEnrol(approved, new Date("2026-11-21T09:30:00Z"))).toBe(false);
    expect(dueStage(approved, ["pre"], new Date("2026-11-21T12:00:00Z"))).toBeNull();
    expect(dueStage(approved, ["pre"], new Date("2026-11-21T16:00:00Z"))).toBe("post");
    expect(dueStage(approved, ["pre", "post"], new Date("2027-01-16T12:00:00Z"))).toBe("followup");
    expect(dueStage({ ...approved, enabled: false }, [], new Date("2026-11-20T12:00:00Z"))).toBeNull();
    expect(nextStage(approved, ["pre"], new Date("2026-11-21T12:00:00Z"))?.stage).toBe("post");
  });
});

describe("research export", () => {
  const rows: ExportRow[] = [
    { participant_code: "IN-AAAAAA", consent_linkage: true, consent_sharing: false, withdrawn: false, checked_in: true, stage: "pre", answers: fill("pre", { experience: ["none"] }), instrument_version: "1.0", submitted_at: "2026-11-19T20:00:00Z", started_at: "2026-11-19T19:52:00Z" },
    { participant_code: "IN-AAAAAA", consent_linkage: true, consent_sharing: false, withdrawn: false, checked_in: true, stage: "post", answers: fill("post"), instrument_version: "1.0", submitted_at: "2026-11-22T10:00:00Z", started_at: null },
    { participant_code: "IN-BBBBBB", consent_linkage: false, consent_sharing: true, withdrawn: false, checked_in: true, stage: null, answers: null, instrument_version: null, submitted_at: null, started_at: null },
  ];

  it("counts days from the conference in UK dates", () => {
    expect(daysFromEvent("2026-11-21", "2026-11-19T23:30:00Z")).toBe(-2);
    expect(daysFromEvent("2026-11-21", "2026-11-21T00:10:00Z")).toBe(0);
  });

  it("builds one row per participant with paired flags and no identifiers", () => {
    const w = buildWide(rows, "2026-11-21");
    expect(w.rows).toHaveLength(2);
    const a = w.rows[0];
    expect(a.complete_pre_post).toBe(1);
    expect(a.pre_day).toBe(-2);
    expect(a.pre_minutes).toBe(8);
    expect(a.no_prior_experience).toBe(1);
    expect(a.checked_in).toBe(1);
    // Check-in is withheld without consent to linkage.
    expect(w.rows[1].checked_in).toBeNull();
    expect(w.columns.some((c) => /email|name|user_id/i.test(c))).toBe(false);
    for (const c of answerColumns("pre")) expect(w.columns).toContain(c.column);
  });

  it("builds a long file for mixed models", () => {
    const l = buildLong(rows, "2026-11-21");
    expect(l.rows.map((r) => r.time)).toEqual(["pre", "post"]);
    expect(l.rows[1].no_prior_experience).toBe(1);
  });

  it("describes every exported answer column in the codebook", () => {
    const vars = new Set(buildCodebook().rows.map((r) => r.variable));
    for (const s of STAGES) for (const c of answerColumns(s)) expect(vars.has(c.column)).toBe(true);
  });

  it("keeps negative numbers numeric and guards text against formulas", () => {
    const csv = toAnalysisCsv({ columns: ["a", "b", "c"], rows: [{ a: -2, b: "=SUM(A1)", c: null }] });
    expect(csv.split("\r\n")[1]).toBe(`-2,"'=SUM(A1)",`);
  });
});
