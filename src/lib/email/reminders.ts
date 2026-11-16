import { renderEmail, escapeHtml } from "./template";
import type { AccountType, SubmissionKind, SubmissionStatus } from "@/lib/types";

/**
 * Deadline reminders: one email per person listing exactly what they still
 * need to do, by when, and what happens if they don't. Two versions:
 *  - "sign_in": people with a place who haven't signed in to My Hub yet.
 *  - "presenter": oral and poster presenters with presenter tasks left
 *    (bio, photo, slides or poster), needed for the booklet and certificates.
 *  - "final": the last reminder before the deadline, to everyone with a place
 *    and anything left at all. Presenters' photos and biographies are
 *    published in the post-conference booklet and on certificates; delegates'
 *    may be, so they get lighter guidance on writing theirs.
 * Pure functions, so the same logic drives the committee's preview, the
 * recipient list and the emails themselves.
 */
export type ReminderKind = "final" | "sign_in" | "presenter";

export const REMINDER_KINDS: { id: ReminderKind; name: string; use: string }[] = [
  {
    id: "final",
    name: "Final reminder: everyone with tasks left",
    use: "Delegates and presenters with anything still to do. Lists all their tasks, explains how photos and biographies are used in the booklet and on certificates, and warns presenters they may lose their presenting place.",
  },
  {
    id: "sign_in",
    name: "Haven't signed in yet",
    use: "Delegates and presenters with a place who have never signed in to My Hub. Lists everything they still need to do and warns that their delegate place may be offered to someone else.",
  },
  {
    id: "presenter",
    name: "Presenters with tasks left",
    use: "Oral and poster presenters missing a bio, photo, slides or poster. Explains these are needed for the post-conference booklet and certificates, and that their place may be given to someone else.",
  },
];

export type TaskKey = "sign_in" | "attend" | "upload" | "resubmit" | "bio" | "bio_short" | "photo" | "details" | "workshops" | "travel";

export type Task = { key: TaskKey; title: string; detail: string };

/** Everything we know about one person's progress. Booleans are "done". */
export type ReminderPerson = {
  email: string;
  fullName: string | null;
  institution: string | null;
  /** Has an account (rather than only being on the selected list). */
  joined: boolean;
  /** Has ever signed in. */
  signedIn: boolean;
  roles: AccountType[];
  photo: boolean;
  details: boolean;
  bio: string | null;
  travel: boolean;
  /** null when ranking isn't open, so it isn't asked for. */
  ranked: boolean | null;
  /** null if not a presenter. "unavailable" means they've told us they can't present. */
  attendance: "confirmed" | "unavailable" | null;
  /** Latest status of each presentation they upload, null if nothing uploaded. */
  submissions: Partial<Record<SubmissionKind, SubmissionStatus | null>>;
};

const ATTENDING: AccountType[] = ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"];

/** A bio under this many words is too thin for the printed booklet. */
export const BIO_MIN_WORDS = 40;

export const wordCount = (s: string | null | undefined) => (s?.trim() ? s.trim().split(/\s+/).length : 0);

export const isAttending = (p: Pick<ReminderPerson, "roles">) => p.roles.some((r) => ATTENDING.includes(r));

export function presenterKinds(roles: readonly AccountType[]): SubmissionKind[] {
  return [
    ...(roles.includes("oral_presenter") ? (["slides"] as const) : []),
    ...(roles.includes("poster_presenter") || roles.includes("oral_waitlist") ? (["poster"] as const) : []),
  ];
}

const NOUN: Record<SubmissionKind, string> = { slides: "slides", poster: "poster" };

/**
 * What someone still has to do, most important first. For presenters, the
 * booklet and certificate items come before the general ones.
 */
export function outstandingTasks(p: ReminderPerson, opts: { booklet?: boolean } = {}): Task[] {
  const kinds = presenterKinds(p.roles);
  const presenter = kinds.length > 0;
  // Presenters' bios are always printed. With `booklet`, everyone's are.
  const published = presenter || Boolean(opts.booklet);
  const tasks: Task[] = [];

  if (!p.signedIn)
    tasks.push({
      key: "sign_in",
      title: "Sign in to My Hub",
      detail: p.joined
        ? "Use the login details in this email. If it's your first time, you'll be asked to choose your own password."
        : "Your account is ready. Use the login details in this email, then choose your own password.",
    });

  if (presenter && p.attendance === null)
    tasks.push({
      key: "attend",
      title: "Confirm you'll be there to present",
      detail: "One tap in My Hub, so we can finalise the running order.",
    });

  for (const k of kinds) {
    const status = p.submissions[k] ?? null;
    if (status === "changes_requested")
      tasks.push({
        key: "resubmit",
        title: `Upload an updated version of your ${NOUN[k]}`,
        detail: "The committee has left feedback for you in My Hub. Please make the changes and upload the new version.",
      });
    else if (!status)
      tasks.push({
        key: "upload",
        title: k === "slides" ? "Upload your presentation slides" : "Upload a digital copy of your poster",
        detail:
          k === "slides"
            ? "Your final slides as PowerPoint or PDF, under My submission. We load them before the day and use them to confirm the details on your certificate."
            : "A PDF or image of your poster, under My submission. We use it for the post-conference booklet and to confirm the details on your certificate.",
      });
  }

  const words = wordCount(p.bio);
  const covers = `your full name, course, year of study and university, and your interests in medicine and research${presenter ? ", plus what your project explores" : ""}`;
  if (!words)
    tasks.push({
      key: "bio",
      title: opts.booklet && presenter ? "Write your biography for the booklet and certificates" : presenter ? "Write your biography for the booklet" : opts.booklet ? "Write a short biography" : "Write a short bio",
      detail: opts.booklet && presenter
        ? `60 to 100 words, in full sentences and the third person, covering ${covers}. It will be published exactly as you write it, so please check spelling, grammar and capitalisation.`
        : opts.booklet
          ? "Around 60 to 100 words about your course, year and university and your interests. It may be published in the post-conference booklet, so see the tips below."
          : presenter
          ? "60 to 100 words, written in the third person: your course, year and university, your research interests and what your project explores. It's printed beside your abstract, so please check spelling and grammar."
          : "A few lines about you and your interests, so other delegates can get to know you before the day.",
    });
  else if (published && words < BIO_MIN_WORDS)
    tasks.push({
      key: "bio_short",
      title: opts.booklet && presenter ? "Expand your biography for the booklet and certificates" : opts.booklet ? "Add a little more to your biography" : "Expand your biography for the booklet",
      detail: !presenter
        ? `Your biography is currently ${words} ${words === 1 ? "word" : "words"}. As it may be published in the post-conference booklet, please aim for around 60 to 100 words. See the tips below.`
        : opts.booklet
        ? `Your biography is currently ${words} ${words === 1 ? "word" : "words"}, which is too short to publish. Please rewrite it as 60 to 100 words, in full sentences and the third person, covering ${covers}.`
        : `Your bio is currently ${words} ${words === 1 ? "word" : "words"}. For the printed booklet, please expand it to 60 to 100 words in the third person: your course, year and university, your research interests and what your project explores.`,
    });

  if (!p.photo)
    tasks.push({
      key: "photo",
      title: "Add a photo of yourself",
      detail: opts.booklet && presenter
        ? "A clear, recent, front-facing headshot, ideally against a plain background. It is published beside your biography in the post-conference booklet and appears on your Delegate Card."
        : opts.booklet
          ? "A clear, front-facing photo for your Delegate Card. It may also appear beside your biography in the post-conference booklet."
          : presenter
          ? "A clear, front-facing headshot. It appears beside your biography in the booklet and on your Delegate Card."
          : "A clear, front-facing photo for your Delegate Card, so people can find you on the day.",
    });

  if (!p.details)
    tasks.push({
      key: "details",
      title: "Add your university and stage of study",
      detail: presenter ? "Printed under your name in the booklet and on your certificate." : "Shown under your name on your Delegate Card.",
    });

  if (p.ranked === false)
    tasks.push({
      key: "workshops",
      title: "Rank your workshops",
      detail: "Put the workshops in the order you'd most like to attend. Places are allocated from these rankings.",
    });

  if (!p.travel)
    tasks.push({
      key: "travel",
      title: "Tell us how you're getting to Lincoln",
      detail: "Coach, train, car or local. It helps us plan arrivals, parking and the coaches.",
    });

  return tasks;
}

/** The tasks that matter for the presenter reminder: the booklet and certificate items. */
export const PRESENTER_TASKS: TaskKey[] = ["sign_in", "attend", "upload", "resubmit", "bio", "bio_short", "photo", "details"];

/** Whether someone should get this reminder at all. */
export function needsReminder(kind: ReminderKind, p: ReminderPerson) {
  if (!isAttending(p)) return false;
  // Presenters who've told us they can't come aren't chased for presenter tasks.
  if (kind === "final") return p.attendance !== "unavailable" && tasksFor("final", p).length > 0;
  if (kind === "sign_in") return !p.signedIn;
  if (!presenterKinds(p.roles).length || p.attendance === "unavailable") return false;
  return outstandingTasks(p).some((t) => PRESENTER_TASKS.includes(t.key) && t.key !== "sign_in" && t.key !== "attend");
}

/** "2026-11-16" + "21:00" → "Monday 16 November, 9pm" (the date is read as written, no time zone shifts). */
export function formatDeadline(date: string, time?: string | null) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const t = time && /^(\d{2}):(\d{2})$/.exec(time);
  if (!t) return day;
  const h = +t[1];
  const min = +t[2];
  const clock = h === 12 && min === 0 ? "midday" : h === 0 && min === 0 ? "midnight" : `${h % 12 || 12}${min ? `:${String(min).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
  return `${day}, ${clock}`;
}

export type ReminderEmailInput = {
  kind: ReminderKind;
  siteUrl: string;
  name: string | null;
  roles: AccountType[];
  tasks: Task[];
  /** Already formatted, e.g. "Monday 16 November, 9pm". */
  deadline: string;
  /** Rows for the login box, when the committee includes login details. */
  login?: { label: string; value: string }[];
  /** Final reminder: they already have a full-length bio, so we only ask them to re-read it. */
  bioDone?: boolean;
  /** Optional extra line from the committee. Plain text. */
  note?: string | null;
  sender?: string | null;
};

const firstName = (name: string | null) => {
  const f = name?.trim().split(/\s+/)[0];
  return f ? escapeHtml(f) : "there";
};

/** The reminder email for one person. */
export function reminderEmail(o: ReminderEmailInput) {
  const presenter = presenterKinds(o.roles).length > 0;
  const kinds = presenterKinds(o.roles);
  const what = kinds.includes("slides") ? "oral presentation" : "poster presentation";
  const count = o.tasks.length;
  const things = `${count} ${count === 1 ? "thing" : "things"}`;
  const note = o.note?.trim() ? [escapeHtml(o.note.trim()).replace(/\n/g, "<br>")] : [];
  const signOff = o.sender ? `${escapeHtml(o.sender)}<br>On behalf of the INSPIRE committee` : "Warm regards,<br>The INSPIRE committee";

  if (o.kind === "final") return finalEmail(o, { presenter, what, count, things, note, signOff });

  if (o.kind === "sign_in") {
    const subject = `Action needed: sign in to My Hub by ${o.deadline}`;
    const r = renderEmail({
      siteUrl: o.siteUrl,
      preheader: `You haven't signed in to My Hub yet. Please complete ${things} by ${o.deadline} to keep your place at INSPIRE 2026.`,
      eyebrow: "Action needed",
      heading: "Your place at INSPIRE 2026 is waiting",
      paragraphs: [
        `Hello ${firstName(o.name)},`,
        `We're looking forward to welcoming you to Lincoln on Saturday 21 November. Our records show you haven't signed in to My Hub yet, and there ${count === 1 ? "is" : "are"} <strong>${things}</strong> we still need from you before the deadline.`,
        presenter
          ? `As you're giving ${what === "oral presentation" ? "an" : "a"} ${what}, some of these are needed for the post-conference booklet and your certificate, so please don't leave them until the last minute.`
          : "They only take a few minutes, and they help us get your Delegate Card, workshop places and travel ready for the day.",
        ...note,
      ],
      deadline: { label: "Please complete by", value: o.deadline },
      checklist: o.tasks.map((t) => ({ title: t.title, detail: t.detail })),
      callout: {
        title: "Please don't miss this",
        body: `Places at INSPIRE are limited and in high demand. If you haven't signed in and completed these by <strong>${escapeHtml(o.deadline)}</strong>, your ${presenter ? "place" : "delegate place"} may be given to someone on the waiting list.`,
      },
      details: o.login,
      cta: { label: "Sign in to My Hub", url: `${o.siteUrl}/login` },
      closing: [signOff],
      footnote: `You're receiving this because you have a place at INSPIRE 2026 and it's about the conference.${o.login?.some((d) => /temporary/i.test(d.label)) ? " Keep this email private. The temporary password only works until you choose your own." : ""}`,
    });
    return { subject, ...r };
  }

  const subject = `Action needed: complete your presenter tasks by ${o.deadline}`;
  const r = renderEmail({
    siteUrl: o.siteUrl,
    preheader: `${things} left before ${o.deadline}: needed for the INSPIRE 2026 booklet and your certificate.`,
    eyebrow: `Your ${what}`,
    heading: "A few things we need for your presentation",
    paragraphs: [
      `Hello ${firstName(o.name)},`,
      `Congratulations again on being selected for ${what === "oral presentation" ? "an" : "a"} ${what} at INSPIRE 2026. To finalise the programme, we need every presenter to complete their tasks in My Hub. You still have <strong>${things}</strong> left to do.`,
      "Your biography, photo and presentation are printed in the <strong>post-conference booklet</strong> and used to prepare your <strong>certificate of presentation</strong>, so we need them complete and accurate.",
      ...note,
    ],
    deadline: { label: "Please complete by", value: o.deadline },
    checklist: o.tasks.map((t) => ({ title: t.title, detail: t.detail })),
    callout: {
      title: "Your place depends on it",
      body: `If these aren't completed by <strong>${escapeHtml(o.deadline)}</strong>, we may not be able to include you in the booklet or issue your certificate, and your presentation place may be given to someone on the waiting list.`,
    },
    details: o.login,
    cta: { label: "Open My Hub", url: `${o.siteUrl}/${o.tasks.some((t) => t.key === "sign_in") ? "login" : "portal"}` },
    closing: [signOff],
    footnote: `You're receiving this because you're presenting at INSPIRE 2026 and it's about the conference.${o.login?.some((d) => /temporary/i.test(d.label)) ? " Keep this email private. The temporary password only works until you choose your own." : ""}`,
  });
  return { subject, ...r };
}

const BIO_EXAMPLE =
  "“Amara Okafor is a third-year medical student at the University of Lincoln. She is particularly interested in cardiology and in how digital tools can improve patient care, and she is an active member of her university's student research society. Her project, presented at INSPIRE 2026, explores how wearable devices could support the earlier detection of atrial fibrillation in primary care.”";

/** The final reminder: every task left, the booklet standard for bios, and what's at stake. */
function finalEmail(
  o: ReminderEmailInput,
  x: { presenter: boolean; what: string; count: number; things: string; note: string[]; signOff: string },
) {
  const signIn = o.tasks.some((t) => t.key === "sign_in");
  const bioTask = o.tasks.some((t) => t.key === "bio" || t.key === "bio_short");
  const an = x.what === "oral presentation" ? "an" : "a";
  const deadline = escapeHtml(o.deadline);

  const notes: { title: string; body: string }[] = [];
  if (bioTask && !x.presenter)
    notes.push({
      title: "Tips for your biography",
      body: "Your photo and biography may be published in the post-conference booklet and on certificates, so it's worth a few minutes to get it right. Aim for 60 to 100 words in the third person (“Amara is…”), mention your course, year and university and your interests, and give it a quick check for spelling and grammar.",
    });
  else if (bioTask)
    notes.push({
      title: "Your biography will be published",
      body: [
        "Your photo and biography will be published in the <strong>post-conference booklet</strong> and on <strong>certificates</strong>, exactly as you submit them. Please take ten minutes to write yours properly. A good biography is:",
        "• <strong>60 to 100 words</strong>, written in full sentences",
        "• In the <strong>third person</strong> (“Amara is…”, not “I am…”)",
        `• About your full name, course, year of study and university, and your interests in medicine and research${x.presenter ? ", plus what your project explores" : ""}`,
        "• Carefully checked for spelling, grammar and capitalisation, with no abbreviations, emojis or text speak",
        "",
        `<em>For example:</em> ${BIO_EXAMPLE}`,
      ].join("<br>"),
    });
  else if (o.bioDone && x.presenter)
    notes.push({
      title: "Please re-read your biography",
      body: "Your photo and biography will be published in the <strong>post-conference booklet</strong> and on <strong>certificates</strong>, exactly as submitted. Before the deadline, please re-read yours in My Hub and make sure it's 60 to 100 words, written in the third person, and free of spelling and grammar mistakes.",
    });

  const callout = x.presenter
    ? {
        title: "You may lose your presenting place",
        body: `If your tasks aren't completed by <strong>${deadline}</strong>, you may lose your presenting place, which will be offered to someone on the waiting list. We would also be unable to include you in the booklet or issue your certificate of presentation.`,
      }
    : signIn
      ? {
          title: "Your place depends on it",
          body: `Places at INSPIRE are limited and in high demand. If you haven't signed in and completed these by <strong>${deadline}</strong>, your delegate place may be given to someone on the waiting list.`,
        }
      : {
          title: "Please don't miss the deadline",
          body: `We finalise the booklet, certificates, workshop places and travel plans straight after <strong>${deadline}</strong>, so anything still missing then may not be included.`,
        };

  const subject = `Final reminder: ${x.things} to complete by ${o.deadline}`;
  const r = renderEmail({
    siteUrl: o.siteUrl,
    preheader: `This is our last reminder. Please complete ${x.things} in My Hub by ${o.deadline}.`,
    eyebrow: "Final reminder",
    heading: x.presenter ? "Last chance to complete your presenter tasks" : "Last chance to complete your tasks",
    paragraphs: [
      `Hello ${firstName(o.name)},`,
      `This is our final reminder before the deadline of <strong>${deadline}</strong>. We're looking forward to welcoming you to Lincoln on Saturday 21 November, and there ${x.count === 1 ? "is" : "are"} still <strong>${x.things}</strong> we need from you.${signIn ? " You haven't signed in to My Hub yet, so your login details are below." : ""}`,
      x.presenter
        ? `As you're giving ${an} ${x.what}, these are needed to finalise the programme, the <strong>post-conference booklet</strong> and your <strong>certificate of presentation</strong>. Please complete every item below.`
        : "Please complete every item below. Each one only takes a few minutes in My Hub.",
      ...x.note,
    ],
    deadline: { label: "Final deadline", value: o.deadline },
    checklist: o.tasks.map((t) => ({ title: t.title, detail: t.detail })),
    notes,
    callout,
    details: o.login,
    cta: { label: "Complete my tasks", url: `${o.siteUrl}/${signIn ? "login" : "portal"}` },
    closing: ["Thank you, and we can't wait to see you in Lincoln.", x.signOff],
    footnote: `You're receiving this because you have a place at INSPIRE 2026 and it's about the conference.${o.login?.some((d) => /temporary/i.test(d.label)) ? " Keep this email private. The temporary password only works until you choose your own." : ""}`,
  });
  return { subject, ...r };
}

/** Tasks to list in a given reminder: the presenter email sticks to presenter items, the final one lists everything. */
export function tasksFor(kind: ReminderKind, p: ReminderPerson) {
  if (kind === "final") return outstandingTasks(p, { booklet: true });
  const all = outstandingTasks(p);
  return kind === "presenter" ? all.filter((t) => PRESENTER_TASKS.includes(t.key)) : all;
}
