import { renderEmail, escapeHtml } from "./template";
import type { AccountType, SubmissionKind, SubmissionStatus } from "@/lib/types";

/**
 * Deadline reminders: one email per person listing exactly what they still
 * need to do, by when, and what happens if they don't. Two versions:
 *  - "sign_in": people with a place who haven't signed in to My Hub yet.
 *  - "presenter": oral and poster presenters with presenter tasks left
 *    (bio, photo, slides or poster), needed for the booklet and certificates.
 * Pure functions, so the same logic drives the committee's preview, the
 * recipient list and the emails themselves.
 */
export type ReminderKind = "sign_in" | "presenter";

export const REMINDER_KINDS: { id: ReminderKind; name: string; use: string }[] = [
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
export function outstandingTasks(p: ReminderPerson): Task[] {
  const kinds = presenterKinds(p.roles);
  const presenter = kinds.length > 0;
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
  if (!words)
    tasks.push({
      key: "bio",
      title: presenter ? "Write your biography for the booklet" : "Write a short bio",
      detail: presenter
        ? "60 to 100 words, written in the third person: your course, year and university, your research interests and what your project explores. It's printed beside your abstract, so please check spelling and grammar."
        : "A few lines about you and your interests, so other delegates can get to know you before the day.",
    });
  else if (presenter && words < BIO_MIN_WORDS)
    tasks.push({
      key: "bio_short",
      title: "Expand your biography for the booklet",
      detail: `Your bio is currently ${words} ${words === 1 ? "word" : "words"}. For the printed booklet, please expand it to 60 to 100 words in the third person: your course, year and university, your research interests and what your project explores.`,
    });

  if (!p.photo)
    tasks.push({
      key: "photo",
      title: "Add a photo of yourself",
      detail: presenter
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

/** Tasks to list in a given reminder: the presenter email sticks to presenter items. */
export function tasksFor(kind: ReminderKind, p: ReminderPerson) {
  const all = outstandingTasks(p);
  return kind === "presenter" ? all.filter((t) => PRESENTER_TASKS.includes(t.key)) : all;
}
