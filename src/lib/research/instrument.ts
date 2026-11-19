/**
 * The three questionnaires of the INSPIRE research study, as data.
 *
 * One definition drives the questionnaire pages, the server-side checks,
 * the scoring and the codebook that goes out with every export, so the
 * wording a participant saw and the variable an analyst gets can never
 * drift apart. Change the wording only with a protocol amendment, and bump
 * INSTRUMENT_VERSION when you do: every response stores the version it was
 * answered on.
 *
 * Outcome questions are asked in exactly the same words at every stage that
 * repeats them, so answers can be paired person by person.
 */

export const INSTRUMENT_VERSION = "1.0";

export const STAGES = ["pre", "post", "followup"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, { title: string; short: string; minutes: number; prefix: string }> = {
  pre: { title: "Before the conference", short: "Questionnaire 1 of 3", minutes: 5, prefix: "pre" },
  post: { title: "After the conference", short: "Questionnaire 2 of 3", minutes: 4, prefix: "post" },
  followup: { title: "Eight weeks on", short: "Questionnaire 3 of 3", minutes: 5, prefix: "fu" },
};

export type Option = { value: string; label: string };

type Base = {
  id: string;
  /** Wording, the same at every stage unless a stage needs its own time frame. */
  text: string | Partial<Record<Stage, string>>;
  hint?: string;
  optional?: boolean;
  /** Short label for the codebook. */
  label: string;
};

export type Item =
  | (Base & { kind: "scale"; min: number; max: number; minLabel: string; maxLabel: string })
  | (Base & { kind: "single"; options: Option[] })
  | (Base & { kind: "multi"; options: Option[]; /** Choosing this clears the others. */ exclusive?: string })
  | (Base & { kind: "text"; maxLength: number });

export type Section = {
  id: string;
  title: string | Partial<Record<Stage, string>>;
  intro?: string | Partial<Record<Stage, string>>;
  stages: readonly Stage[];
  /** Only asked when an earlier answer allows it. */
  when?: { item: string; notIn: string[] };
  items: Item[];
};

export function textFor(t: string | Partial<Record<Stage, string>>, stage: Stage): string {
  return typeof t === "string" ? t : (t[stage] ?? Object.values(t)[0] ?? "");
}

const AGREE: Option[] = [
  { value: "1", label: "Strongly disagree" },
  { value: "2", label: "Disagree" },
  { value: "3", label: "Neither agree nor disagree" },
  { value: "4", label: "Agree" },
  { value: "5", label: "Strongly agree" },
];

const YES_NO: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const COUNT: Option[] = [
  { value: "0", label: "None" },
  { value: "1", label: "1" },
  { value: "2-3", label: "2 or 3" },
  { value: "4+", label: "4 or more" },
];

/**
 * Primary outcome: the 12-item Clinical Research Appraisal Inventory
 * (CRAI-12; Robinson et al., Acad Med 2013;88:1340-5), reproduced word for
 * word with its 0-10 confidence scale. Cite it in every output.
 */
export const CRAI12: { id: string; text: string; factor: string }[] = [
  { id: "se_01", text: "Select a suitable topic area for study", factor: "Conceptualising and collaborating" },
  { id: "se_02", text: "Design the best data analysis strategy for your study", factor: "Designing and collecting" },
  { id: "se_03", text: "Determine an adequate number of subjects for your research project", factor: "Designing and collecting" },
  {
    id: "se_04",
    text: "Describe the proposal review and award process for a major funding agency, such as the National Institute of Health, National Science Foundation, or other foundation",
    factor: "Funding",
  },
  { id: "se_05", text: "Locate appropriate forms for a grant application", factor: "Funding" },
  { id: "se_06", text: "Set expectations and communicate them to other team members", factor: "Planning" },
  { id: "se_07", text: "Ask team members to leave the project team when necessary", factor: "Planning" },
  { id: "se_08", text: "Describe ethical concerns with the use of placebos in clinical research", factor: "Protecting" },
  { id: "se_09", text: "Apply the appropriate process for obtaining informed consent from research subjects", factor: "Protecting" },
  {
    id: "se_10",
    text: "Write the results section of a research paper that clearly summarized and describes the results, free of interpretative comments",
    factor: "Reporting, interpreting and presenting",
  },
  {
    id: "se_11",
    text: "Write a discussion section for a research paper that articulates the importance of your findings relative to other studies in the field",
    factor: "Reporting, interpreting and presenting",
  },
  { id: "se_12", text: "Identify collaborations from within and outside the discipline who can offer guidance to the project", factor: "Conceptualising and collaborating" },
];

/** Secondary outcome: perceived access to research opportunities (developed for this study). */
export const ACCESS_ITEMS: { id: string; text: string }[] = [
  { id: "acc_01", text: "I know how to find research opportunities that are open to students at my stage." },
  { id: "acc_02", text: "I know at least one academic, clinician or researcher I could approach about getting involved in research." },
  { id: "acc_03", text: "Research opportunities are open to students like me." },
  { id: "acc_04", text: "If I contacted an academic about research, I would expect them to take my request seriously." },
  { id: "acc_05", text: "I know what to say when I contact someone about a research opportunity." },
];

/**
 * The research actions measured as behaviour (pre: "in the last 8 weeks",
 * follow-up: "since the conference"), so each person's 8 weeks after can be
 * compared with their own 8 weeks before.
 */
export const ACTIONS: { id: string; text: string }[] = [
  { id: "a1", text: "Contact an academic, clinician or researcher to ask about getting involved in research" },
  { id: "a2", text: "Apply for a research opportunity (for example a project, summer studentship, internship or intercalated degree)" },
  { id: "a3", text: "Join or start a research, audit or quality improvement project" },
  { id: "a4", text: "Find a new research mentor or supervisor" },
  { id: "a5", text: "Work on a research output (an abstract, poster, presentation or manuscript)" },
  { id: "a6", text: "Submit an abstract or manuscript to a conference or journal" },
];

const PAST: Record<string, string> = {
  a1: "Contacted an academic, clinician or researcher to ask about getting involved in research",
  a2: "Applied for a research opportunity (for example a project, summer studentship, internship or intercalated degree)",
  a3: "Joined or started a research, audit or quality improvement project",
  a4: "Found a new research mentor or supervisor",
  a5: "Worked on a research output (an abstract, poster, presentation or manuscript)",
  a6: "Submitted an abstract or manuscript to a conference or journal",
};

export const WORKSHOPS: Option[] = [
  { value: "w1", label: "Get Published: From First Draft to Accepted Paper" },
  { value: "w2", label: "Doctor for the Day: Clinical Cases Simulation" },
  { value: "w3", label: "Don't Believe the Headline: Spotting Research You Can Trust" },
  { value: "w4", label: "Stand Out: Building a Competitive Clinical Portfolio" },
  { value: "w5", label: "Theatre of the Future: Digital Surgery and Simulation" },
  { value: "w6", label: "Left Offline: Global Digital Health Inequalities" },
];

const BARRIERS: Option[] = [
  { value: "time", label: "Not enough time alongside my course" },
  { value: "find", label: "Not knowing where to find opportunities" },
  { value: "who", label: "Not knowing who to contact" },
  { value: "mentor", label: "Not having a mentor or supervisor" },
  { value: "skills", label: "Not feeling confident in my research skills" },
  { value: "competition", label: "Too much competition for too few opportunities" },
  { value: "money", label: "Cost, or needing to do paid work" },
  { value: "commitments", label: "Caring or other commitments" },
  { value: "belong", label: "Not feeling that research is for people like me" },
  { value: "interest", label: "I'm not interested in research at the moment" },
  { value: "none", label: "None of these" },
];

const MENTOR: Item = {
  id: "mentor",
  kind: "single",
  label: "Currently has a research mentor or adviser",
  text: "Do you currently have someone (an academic, clinician or researcher) who advises or supports you with research?",
  options: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
    { value: "unsure", label: "Not sure" },
  ],
};

export const SECTIONS: Section[] = [
  {
    id: "about",
    title: "About you",
    intro: "So we can describe who took part and compare students at different stages. Nothing here is shared in a way that could identify you.",
    stages: ["pre"],
    items: [
      {
        id: "discipline",
        kind: "single",
        label: "Course",
        text: "What are you studying?",
        options: [
          { value: "medicine", label: "Medicine" },
          { value: "healthcare", label: "Another healthcare course (for example nursing, pharmacy, physiotherapy, physician associate)" },
          { value: "bioscience", label: "Biomedical or life sciences" },
          { value: "other", label: "Something else" },
        ],
      },
      {
        id: "stage",
        kind: "single",
        label: "Year of study",
        text: "Which year of your course are you in?",
        options: [
          { value: "foundation", label: "Foundation or gateway year" },
          { value: "y1", label: "Year 1" },
          { value: "y2", label: "Year 2" },
          { value: "y3", label: "Year 3" },
          { value: "y4", label: "Year 4" },
          { value: "y5plus", label: "Year 5 or above" },
          { value: "intercalating", label: "Intercalating" },
          { value: "postgrad", label: "Postgraduate or graduate" },
        ],
      },
      {
        id: "university",
        kind: "single",
        label: "University (grouped)",
        text: "Where do you study?",
        hint: "Smaller groups are combined so nobody can be identified.",
        options: [
          { value: "lincoln", label: "University of Lincoln" },
          { value: "uea", label: "University of East Anglia" },
          { value: "nottingham", label: "University of Nottingham" },
          { value: "other", label: "Another university" },
        ],
      },
      {
        id: "role",
        kind: "single",
        label: "Role at the conference",
        text: "Are you presenting at INSPIRE 2026?",
        options: [
          { value: "delegate", label: "No, I'm attending as a delegate" },
          { value: "poster", label: "Yes, a poster" },
          { value: "oral", label: "Yes, an oral presentation" },
          { value: "not_attending", label: "I'm not attending (for example, I'm on the waiting list)" },
        ],
      },
      {
        id: "experience",
        kind: "multi",
        label: "Previous research experience",
        text: "Which of these have you done before? Choose all that apply.",
        exclusive: "none",
        options: [
          { value: "project", label: "A research project, including a course project or dissertation" },
          { value: "audit", label: "An audit or quality improvement project" },
          { value: "review", label: "A literature or systematic review intended for publication" },
          { value: "presented", label: "Presented a poster or talk at a conference" },
          { value: "published", label: "Been an author on a published paper or abstract" },
          { value: "none", label: "None of these" },
        ],
      },
      {
        id: "first_gen",
        kind: "single",
        label: "First in immediate family to attend university",
        text: "Are you the first person in your immediate family to go to university?",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "pnts", label: "Prefer not to say" },
        ],
      },
      {
        id: "gender",
        kind: "single",
        label: "Gender",
        text: "How do you describe your gender?",
        options: [
          { value: "woman", label: "Woman" },
          { value: "man", label: "Man" },
          { value: "other", label: "Non-binary, or in another way" },
          { value: "pnts", label: "Prefer not to say" },
        ],
      },
    ],
  },
  {
    id: "attended",
    title: "The conference",
    stages: ["post"],
    items: [
      {
        id: "attended",
        kind: "single",
        label: "Attended INSPIRE 2026",
        text: "Did you attend INSPIRE on Saturday 21 November?",
        options: [
          { value: "all", label: "Yes, for all or most of the day" },
          { value: "part", label: "Yes, for part of the day" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    id: "crai",
    title: "Confidence in research tasks",
    intro:
      "The following items are tasks related to performing clinical research. Please indicate your ability to successfully perform each task, with 0 = No Confidence and 10 = Total Confidence that you can successfully perform these tasks today. There are no right answers: many students at every stage choose low numbers.",
    stages: STAGES,
    items: CRAI12.map((q) => ({ id: q.id, kind: "scale" as const, label: `CRAI-12: ${q.text}`, text: q.text, min: 0, max: 10, minLabel: "No confidence", maxLabel: "Total confidence" })),
  },
  {
    id: "overall",
    title: "Research and your career",
    stages: STAGES,
    items: [
      {
        id: "career_interest",
        kind: "scale",
        label: "Interest in research as part of future career",
        text: "How much would you like research to be part of your future career?",
        min: 0,
        max: 10,
        minLabel: "Not at all",
        maxLabel: "Very much",
      },
    ],
  },
  {
    id: "access",
    title: "Finding research opportunities",
    intro: "How much do you agree or disagree with each statement?",
    stages: STAGES,
    items: ACCESS_ITEMS.map((q) => ({ id: q.id, kind: "single" as const, label: `Access: ${q.text}`, text: q.text, options: AGREE })),
  },
  {
    id: "actions",
    title: { pre: "The last eight weeks", followup: "Since the conference" },
    intro: {
      pre: "In the last 8 weeks, have you done any of these? Answer for the last 8 weeks only, even if you did them earlier as well.",
      followup: "Since the conference on 21 November, have you done any of these? Count anything you did, whether or not it had anything to do with the conference.",
    },
    stages: ["pre", "followup"],
    items: ACTIONS.map((a) => ({ id: `beh_${a.id}`, kind: "single" as const, label: `Behaviour (8-week window): ${PAST[a.id]}`, text: PAST[a.id], options: YES_NO })),
  },
  {
    id: "connections",
    title: "Who you met",
    intro: "About the conference day only.",
    stages: ["post"],
    when: { item: "attended", notIn: ["no"] },
    items: [
      {
        id: "activities",
        kind: "multi",
        label: "Parts of the programme taken part in",
        text: "Which parts of the programme did you take part in? Choose all that apply.",
        exclusive: "none",
        options: [
          { value: "keynotes", label: "Keynote talks" },
          { value: "orals", label: "Oral presentations" },
          { value: "posters", label: "The poster exhibition (looking at or discussing posters)" },
          { value: "presented", label: "I presented my own work" },
          { value: "none", label: "None of these" },
        ],
      },
      {
        id: "workshops",
        kind: "multi",
        label: "Workshops attended",
        text: "Which workshops did you attend? Choose all that apply.",
        exclusive: "none",
        options: [...WORKSHOPS, { value: "none", label: "I didn't attend a workshop" }],
      },
      {
        id: "academic_contacts",
        kind: "single",
        label: "Academics, clinicians or researchers spoken to about research",
        text: "How many academics, clinicians or researchers did you have a conversation with about research?",
        options: COUNT,
      },
      {
        id: "opportunity_discussed",
        kind: "single",
        label: "Someone discussed a specific research opportunity",
        text: "Did anyone talk to you about a specific research opportunity, such as a project you could join?",
        options: YES_NO,
      },
      {
        id: "follow_up_arranged",
        kind: "single",
        label: "Arranged to follow up with someone about research",
        text: "Did you arrange to follow up with anyone about research?",
        options: YES_NO,
      },
    ],
  },
  {
    id: "context",
    title: "Your situation now",
    stages: ["pre", "followup"],
    items: [
      MENTOR,
      {
        id: "barriers",
        kind: "multi",
        label: "Current barriers to research",
        text: "Which of these make it harder for you to get involved in research at the moment? Choose all that apply.",
        exclusive: "none",
        options: BARRIERS,
      },
    ],
  },
  {
    id: "since",
    title: "Since the conference",
    stages: ["followup"],
    items: [
      {
        id: "inspire_contact",
        kind: "single",
        label: "In touch about research with someone met at INSPIRE",
        text: "Since the conference, have you been in touch about research with anyone you met there?",
        options: [...YES_NO, { value: "na", label: "I didn't attend" }],
      },
      {
        id: "other_event",
        kind: "single",
        label: "Attended another research conference or research-skills event since",
        text: "Since the conference, have you attended another research conference or research-skills event?",
        options: YES_NO,
      },
      {
        id: "easier",
        kind: "text",
        label: "Free text: what would make research easier to get involved in",
        text: "What, if anything, would make it easier for you to get involved in research?",
        optional: true,
        maxLength: 1000,
      },
    ],
  },
];

/** The sections a stage asks, in order. */
export function sectionsFor(stage: Stage): Section[] {
  return SECTIONS.filter((s) => s.stages.includes(stage));
}

export function sectionTitle(s: Section, stage: Stage) {
  return textFor(s.title, stage);
}

/** Whether a section is asked, given the answers so far. */
export function sectionApplies(s: Section, answers: Answers): boolean {
  if (!s.when) return true;
  const v = answers[s.when.item];
  return typeof v === "string" && !s.when.notIn.includes(v);
}

export type Answer = string | string[];
export type Answers = Record<string, Answer>;

/** Every item a stage could ask, with its section, in order. */
export function itemsFor(stage: Stage): { section: Section; item: Item }[] {
  return sectionsFor(stage).flatMap((section) => section.items.map((item) => ({ section, item })));
}

/**
 * Checks a set of answers for a stage. Returns the clean answers (unknown
 * keys and answers to skipped sections dropped) or the first problem.
 */
export function validateAnswers(stage: Stage, raw: unknown): { ok: true; answers: Answers } | { ok: false; error: string; item?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "No answers were sent." };
  const input = raw as Record<string, unknown>;
  const out: Answers = {};
  for (const section of sectionsFor(stage)) {
    if (!sectionApplies(section, out)) continue;
    for (const item of section.items) {
      const v = input[item.id];
      const missing = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (missing) {
        if (item.optional) continue;
        return { ok: false, error: "Please answer every question.", item: item.id };
      }
      if (item.kind === "scale") {
        const n = typeof v === "string" ? Number(v) : NaN;
        if (!Number.isInteger(n) || n < item.min || n > item.max) return { ok: false, error: "One answer is out of range.", item: item.id };
        out[item.id] = String(n);
      } else if (item.kind === "single") {
        if (typeof v !== "string" || !item.options.some((o) => o.value === v)) return { ok: false, error: "One answer isn't one of the choices.", item: item.id };
        out[item.id] = v;
      } else if (item.kind === "multi") {
        if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !item.options.some((o) => o.value === x))) return { ok: false, error: "One answer isn't one of the choices.", item: item.id };
        const uniq = [...new Set(v as string[])];
        if (item.exclusive && uniq.includes(item.exclusive) && uniq.length > 1) return { ok: false, error: `"${item.options.find((o) => o.value === item.exclusive)?.label}" can't be chosen with other answers.`, item: item.id };
        out[item.id] = item.options.map((o) => o.value).filter((x) => uniq.includes(x));
      } else {
        if (typeof v !== "string") return { ok: false, error: "One answer isn't text.", item: item.id };
        const t = v.trim().slice(0, item.maxLength);
        if (t) out[item.id] = t;
      }
    }
  }
  return { ok: true, answers: out };
}
