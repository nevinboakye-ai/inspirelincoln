import { escapeHtml, renderEmail } from "@/lib/email/template";

/**
 * Things the committee can ask one person to do, from the delegate network or
 * their account page. Each one links straight to where they do it.
 */
export const REQUEST_ITEMS = {
  sign_in: { label: "Sign in and finish setting up your account", short: "Sign in", path: "/login?next=/portal" },
  details: { label: "Check your name, university and year of study are right", short: "Check details", path: "/portal/profile" },
  photo: { label: "Add a profile photo", short: "Add a photo", path: "/portal/profile" },
  bio: { label: "Write a short bio for the delegate network", short: "Write a bio", path: "/portal/network" },
  needs: { label: "Tell us about any access or dietary needs", short: "Access and dietary needs", path: "/portal/profile" },
  attendance: { label: "Confirm you're coming to present on the day", short: "Confirm attendance", path: "/portal" },
  slides: { label: "Upload your presentation slides", short: "Upload slides", path: "/portal/submission" },
  poster: { label: "Upload your poster", short: "Upload poster", path: "/portal/submission" },
  travel: { label: "Tell us how you're travelling, with your car registration if you're driving", short: "Travel", path: "/portal" },
  workshops: { label: "Rank your workshop choices", short: "Rank workshops", path: "/portal" },
} as const;
export type RequestItem = keyof typeof REQUEST_ITEMS;
export const REQUEST_KEYS = Object.keys(REQUEST_ITEMS) as RequestItem[];

const first = (name: string | null) => (name?.trim().split(/\s+/)[0] ? escapeHtml(name.trim().split(/\s+/)[0]) : "there");

/** "Friday 20 November" from yyyy-mm-dd. */
export function formatDeadline(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
}

/** The branded email asking someone to do a few things before a deadline. */
export function requestEmail(opts: {
  siteUrl: string;
  name: string | null;
  items: RequestItem[];
  note?: string | null;
  deadline?: string | null;
  sender: string;
}) {
  const { siteUrl, name, items, note, deadline, sender } = opts;
  const by = deadline ? formatDeadline(deadline) : null;
  const list = items.map(
    (k, i) =>
      `<strong>${i + 1}.</strong>&nbsp; <a href="${siteUrl}${REQUEST_ITEMS[k].path}" style="color:#1a3154;font-weight:600;">${escapeHtml(REQUEST_ITEMS[k].label)}</a>`,
  );
  const m = renderEmail({
    siteUrl,
    preheader: by ? `A few things to do in My Hub by ${by}.` : "A few things to do in My Hub.",
    eyebrow: "From the committee",
    heading: items.length === 1 ? "One thing to do" : `${items.length} things to do`,
    paragraphs: [
      `Hello ${first(name)},`,
      by
        ? `The INSPIRE committee has asked you to do the following in My Hub by <strong>${escapeHtml(by)}</strong>:`
        : "The INSPIRE committee has asked you to do the following in My Hub:",
      ...list,
      ...(note ? [`A note from ${escapeHtml(sender)}: &ldquo;${escapeHtml(note).replace(/\n/g, "<br>")}&rdquo;`] : []),
      "Each one only takes a minute. Thank you for helping us get everything ready for the day.",
    ],
    cta: { label: "Open My Hub", url: `${siteUrl}/portal` },
    footnote: `Sent by ${escapeHtml(sender)} on behalf of the INSPIRE committee. Reply to this email if you have a question.`,
  });
  const subject = by ? `Action needed by ${by}: your INSPIRE account` : "Action needed: your INSPIRE account";
  return { subject, ...m };
}

/** Lets someone know their account has been removed. */
export function accountRemovedEmail(opts: { siteUrl: string; name: string | null; reason?: string | null }) {
  const m = renderEmail({
    siteUrl: opts.siteUrl,
    preheader: "Your INSPIRE account has been removed.",
    eyebrow: "Account update",
    heading: "Your account has been removed",
    paragraphs: [
      `Hello ${first(opts.name)},`,
      "The INSPIRE committee has removed your account, along with the details, files and choices linked to it.",
      ...(opts.reason ? [`A note from the committee: &ldquo;${escapeHtml(opts.reason).replace(/\n/g, "<br>")}&rdquo;`] : []),
      "If you think this is a mistake, reply to this email and the committee will look into it.",
    ],
  });
  return { subject: "Your INSPIRE account has been removed", ...m };
}
