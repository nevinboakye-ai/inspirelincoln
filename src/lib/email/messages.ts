import { ACCOUNT_TYPE_LABEL, COMMITTEE_TYPES, SUBMISSION_LABEL } from "@/lib/accounts";
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
    const committee = COMMITTEE_TYPES.includes(type);
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

/** Someone on the oral waiting list has been offered an oral presentation slot. */
export function oralSlotEmail(opts: { siteUrl: string; name: string | null }): Mail {
  const m = renderEmail({
    siteUrl: opts.siteUrl,
    preheader: "An oral presentation slot has opened up at INSPIRE 2026, and it's yours.",
    eyebrow: "Oral presentation",
    heading: "A slot has opened up for you.",
    paragraphs: [
      `Hello ${first(opts.name)},`,
      "Good news: an oral presentation slot has become available at INSPIRE 2026, and the committee would like to offer it to you.",
      "Please log in to My Hub to confirm you'll be there to present, then upload your slides. If you can no longer present, let us know in My Hub so we can offer the slot to the next person.",
    ],
    details: [
      { label: "Date", value: "Saturday 21 November 2026" },
      { label: "Venue", value: "Lincoln Medical School, University of Lincoln" },
    ],
    cta: { label: "Open My Hub", url: `${opts.siteUrl}/portal` },
  });
  return { subject: "An oral presentation slot is yours at INSPIRE 2026", ...m };
}

/** Tells someone their roles have changed, for example when they join a committee team as well as presenting. */
export function rolesChangedEmail(opts: { siteUrl: string; name: string | null; types: AccountType[] }): Mail | null {
  const { siteUrl, name, types } = opts;
  const committee = types.some((t) => COMMITTEE_TYPES.includes(t));
  const slides = types.includes("oral_presenter");
  const poster = types.includes("poster_presenter");
  const list = types.map((t) => `<strong>${escapeHtml(ACCOUNT_TYPE_LABEL[t])}</strong>`);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  const m = renderEmail({
    siteUrl,
    preheader: `Your INSPIRE ${types.length > 1 ? "roles have" : "role has"} been updated.`,
    eyebrow: "Account updated",
    heading: types.length > 1 ? "Your roles have changed" : "Your role has changed",
    paragraphs: [
      `Hello ${first(name)},`,
      `The committee has updated your INSPIRE account. You're now ${joined}.`,
      ...(slides || poster ? [`You can upload your ${slides && poster ? "slides and poster" : slides ? "slides" : "poster"} from your account.`] : []),
      ...(committee ? ["You can open the committee dashboard from your account."] : []),
      "If anything here looks wrong, reply to this email and we'll sort it out.",
    ],
    cta: { label: committee ? "Open the dashboard" : "Open My Hub", url: `${siteUrl}${committee ? "/admin" : "/portal"}` },
  });
  return { subject: types.length > 1 ? "Your INSPIRE roles have been updated" : `Your INSPIRE account is now ${ACCOUNT_TYPE_LABEL[types[0]]}`, ...m };
}

/** One conversation someone hasn't opened, for the unread messages email. */
export type UnreadConversation = { conversationId: string; sender: string; unread: number };

/**
 * Someone has had messages waiting on the website for a day without opening
 * them. One email covers every such conversation. The messages stay on the website.
 */
export function unreadMessagesEmail(opts: { siteUrl: string; name: string | null; conversations: UnreadConversation[] }): Mail {
  const list = opts.conversations;
  const one = list.length === 1 ? list[0] : null;
  const senders = list.map((c) => c.sender);
  const who = senders.length === 1 ? senders[0] : senders.length === 2 ? `${senders[0]} and ${senders[1]}` : `${senders[0]} and ${senders.length - 1} others`;
  const total = list.reduce((n, c) => n + Math.max(1, c.unread), 0);
  const noun = total === 1 ? "message" : "messages";
  const m = renderEmail({
    siteUrl: opts.siteUrl,
    preheader: `You have ${total} unread ${noun} on INSPIRE from ${who}.`,
    eyebrow: "Unread messages",
    heading: total === 1 ? "You have an unread message" : `You have ${total} unread messages`,
    paragraphs: [
      `Hello ${first(opts.name)},`,
      one
        ? `<strong>${escapeHtml(one.sender)}</strong> sent you ${total === 1 ? "a message" : `${total} messages`} in My Hub that you haven't read yet.`
        : `You have messages in My Hub that you haven't read yet.`,
      "For your privacy, messages are only shown when you sign in. Reply there and they'll see it straight away.",
    ],
    details: one ? undefined : list.slice(0, 10).map((c) => ({ label: c.sender, value: `${Math.max(1, c.unread)} unread ${c.unread === 1 ? "message" : "messages"}` })),
    cta: { label: one ? "Read the message" : "Open your messages", url: `${opts.siteUrl}/portal/messages${one ? `/${one.conversationId}` : ""}` },
    footnote: "We only email you about messages you haven't opened after a day, and only once until you've read them. You can turn these emails off under Messages in My Hub.",
  });
  return { subject: one ? `Unread message from ${one.sender} on INSPIRE` : `You have unread messages from ${who} on INSPIRE`, ...m };
}
