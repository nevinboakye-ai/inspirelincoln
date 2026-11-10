import { ACCOUNT_TYPE_LABEL, SUBMISSION_LABEL } from "@/lib/accounts";
import type { AccountStatus, AccountType, SubmissionKind } from "@/lib/types";
import { escapeHtml, renderEmail } from "./template";

type Mail = { subject: string; html: string; text: string };

const first = (name: string | null) => (name?.trim().split(/\s+/)[0] ? escapeHtml(name.trim().split(/\s+/)[0]) : "there");

export function accountDecisionEmail(opts: {
  siteUrl: string;
  name: string | null;
  status: AccountStatus;
  type: AccountType;
  note: string | null;
}): Mail | null {
  const { siteUrl, name, status, type, note } = opts;
  const label = ACCOUNT_TYPE_LABEL[type];
  const noteBlock = note ? [`A note from the committee: &ldquo;${escapeHtml(note)}&rdquo;`] : [];
  if (status === "approved") {
    const presenter = type === "oral_presenter" || type === "poster_presenter";
    const committee = !presenter && type !== "delegate";
    const m = renderEmail({
      siteUrl,
      preheader: `Your INSPIRE account is approved as ${label}.`,
      eyebrow: "Account approved",
      heading: "You're in.",
      paragraphs: [
        `Hello ${first(name)},`,
        `Your INSPIRE account has been approved as <strong>${escapeHtml(label)}</strong>.`,
        presenter
          ? `You can now upload your ${type === "oral_presenter" ? "slides" : "poster"} from your account. The committee will review it and send you feedback.`
          : committee
            ? "You now have access to the committee dashboard from your account."
            : "Your Delegate Card and check-in code are waiting in My Hub. Show the code at registration on the day.",
        ...noteBlock,
      ],
      details: [
        { label: "Date", value: "Saturday 21 November 2026" },
        { label: "Venue", value: "Lincoln Medical School, University of Lincoln" },
      ],
      cta: { label: presenter ? "Upload your file" : committee ? "Open the dashboard" : "View your Delegate Card", url: `${siteUrl}${presenter ? "/portal/submission" : committee ? "/admin" : "/portal"}` },
    });
    return { subject: "Your INSPIRE account is approved", ...m };
  }
  if (status === "waitlisted") {
    const m = renderEmail({
      siteUrl,
      preheader: "You're on the INSPIRE waitlist. We'll email you if a place opens up.",
      eyebrow: "Waitlist",
      heading: "You're on the waitlist",
      paragraphs: [
        `Hello ${first(name)},`,
        "Thank you for registering for INSPIRE. Places are currently full, so we've added you to the waitlist.",
        "If a place opens up, we'll approve your account and email you straight away. You don't need to do anything in the meantime.",
        ...noteBlock,
      ],
      cta: { label: "View your account", url: `${siteUrl}/portal` },
    });
    return { subject: "You're on the INSPIRE waitlist", ...m };
  }
  if (status === "declined") {
    const m = renderEmail({
      siteUrl,
      preheader: "An update on your INSPIRE account.",
      eyebrow: "Account update",
      heading: "We couldn't approve your account",
      paragraphs: [
        `Hello ${first(name)},`,
        `We weren't able to approve your account as <strong>${escapeHtml(label)}</strong>.`,
        ...noteBlock,
        "If you think this is a mistake, reply to this email and the committee will take another look.",
      ],
    });
    return { subject: "An update on your INSPIRE account", ...m };
  }
  return null;
}

export function submissionReceivedEmail(opts: { siteUrl: string; name: string | null; kind: SubmissionKind; title: string; version: number }): Mail {
  const noun = SUBMISSION_LABEL[opts.kind].noun;
  const m = renderEmail({
    siteUrl: opts.siteUrl,
    preheader: `We've received your ${noun}. The committee will review it.`,
    eyebrow: "Submission received",
    heading: `We've got your ${noun}`,
    paragraphs: [
      `Hello ${first(opts.name)},`,
      `Thank you. Your ${noun} is safely with the INSPIRE committee, who will review it and send feedback through your account.`,
    ],
    details: [
      { label: "Title", value: opts.title },
      { label: "Version", value: String(opts.version) },
    ],
    cta: { label: "View your submission", url: `${opts.siteUrl}/portal/submission` },
  });
  return { subject: `Your ${noun} has been received`, ...m };
}

export function feedbackEmail(opts: {
  siteUrl: string;
  name: string | null;
  kind: SubmissionKind;
  title: string;
  decision: "comment" | "changes_requested" | "approved";
}): Mail {
  const noun = SUBMISSION_LABEL[opts.kind].noun;
  const heading =
    opts.decision === "approved" ? `Your ${noun} is approved` : opts.decision === "changes_requested" ? `A few changes to your ${noun}` : `New feedback on your ${noun}`;
  const m = renderEmail({
    siteUrl: opts.siteUrl,
    preheader: `The INSPIRE committee has reviewed your ${noun}.`,
    eyebrow: "Committee feedback",
    heading,
    paragraphs: [
      `Hello ${first(opts.name)},`,
      opts.decision === "approved"
        ? `Good news: the committee has approved your ${noun}. There's nothing more you need to do before the day.`
        : opts.decision === "changes_requested"
          ? `The committee has reviewed your ${noun} and asked for some changes. Read their feedback, then upload a new version from your account.`
          : `The committee has left feedback on your ${noun}.`,
      "For your privacy, the feedback itself is only shown when you sign in.",
    ],
    details: [{ label: "Title", value: opts.title }],
    cta: { label: "Read the feedback", url: `${opts.siteUrl}/portal/submission` },
  });
  return { subject: heading, ...m };
}
