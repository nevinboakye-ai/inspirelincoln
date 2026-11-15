import { escapeHtml, renderEmail } from "./template";

/**
 * The account emails: confirming an email address, setting up an account and
 * resetting a password. The site sends these itself through Resend so they
 * always use the INSPIRE design, and scripts/generate-email-templates.ts
 * renders the same words into Supabase's templates as a fallback.
 */

type Mail = { subject: string; html: string; text: string };

const firstName = (name?: string | null) => {
  const f = name?.trim().split(/\s+/)[0];
  return f ? escapeHtml(f) : null;
};
const hello = (name?: string | null) => `Hello ${firstName(name) ?? "there"},`;

const DATE = { label: "Conference", value: "Saturday 21 November 2026" };
const VENUE = { label: "Venue", value: "Lincoln Medical School, University of Lincoln" };

/** Confirms the email address of someone who has just registered or set up their account. */
export function confirmEmailMessage(o: { siteUrl: string; link: string; name?: string | null; selected?: boolean }): Mail {
  const m = renderEmail({
    siteUrl: o.siteUrl,
    preheader: "One tap to confirm your email and open My Hub.",
    eyebrow: "One last step",
    heading: o.selected ? "Confirm your email" : "Welcome to INSPIRE",
    paragraphs: [
      hello(o.name),
      o.selected
        ? "Thank you for setting up your INSPIRE account. Confirm this is your email address and you'll go straight to My Hub, where your next steps are waiting."
        : "Thank you for registering for INSPIRE. Confirm this is your email address so we can finish setting up your account.",
    ],
    checklist: [
      { title: "Tap the button below", detail: "It opens the INSPIRE website." },
      { title: "Tap Confirm my email once more", detail: "This confirms your email and signs you in." },
      o.selected
        ? { title: "Finish your profile in My Hub", detail: "Add your photo and complete your profile before the deadline." }
        : { title: "Wait for the committee", detail: "We review your account and email you as soon as it's approved." },
    ],
    cta: { label: "Confirm my email", url: o.link },
    details: [DATE, VENUE],
    footnote:
      "The link works once and only for a limited time. If it has expired, go to the website and set up your account again with the same email, and we'll send a fresh link. If you didn't sign up for INSPIRE, you can ignore this email.",
  });
  return { subject: "Confirm your email for INSPIRE", ...m };
}

/** For someone who started setting up an account but never confirmed it: confirms the email and lets them choose a password in one go. */
export function finishSetupMessage(o: { siteUrl: string; link: string; name?: string | null }): Mail {
  const m = renderEmail({
    siteUrl: o.siteUrl,
    preheader: "Confirm your email and choose your password to finish setting up your INSPIRE account.",
    eyebrow: "Finish setting up",
    heading: "Finish setting up your account",
    paragraphs: [
      hello(o.name),
      "You've already started setting up an INSPIRE account with this email address, but it hasn't been confirmed yet. Here's a fresh link to finish.",
    ],
    checklist: [
      { title: "Tap the button below, then Continue", detail: "It opens the INSPIRE website." },
      { title: "Choose your password", detail: "This confirms your email at the same time." },
      { title: "You're in", detail: "You'll go straight to My Hub." },
    ],
    cta: { label: "Finish setting up", url: o.link },
    footnote: "The link works once and only for a limited time. If you didn't ask for this, you can ignore this email.",
  });
  return { subject: "Finish setting up your INSPIRE account", ...m };
}

/** Lets someone choose a new password. */
export function resetPasswordMessage(o: { siteUrl: string; link: string; name?: string | null }): Mail {
  const m = renderEmail({
    siteUrl: o.siteUrl,
    preheader: "Choose a new password for your INSPIRE account. The link only works for a limited time.",
    eyebrow: "Password reset",
    heading: "Choose a new password",
    paragraphs: [hello(o.name), "We received a request to reset the password for your INSPIRE account."],
    checklist: [
      { title: "Tap the button below, then Continue", detail: "It opens the INSPIRE website." },
      { title: "Choose a new password", detail: "Use at least 10 characters." },
      { title: "You're in", detail: "You'll be signed in and taken to My Hub." },
    ],
    cta: { label: "Reset my password", url: o.link },
    footnote:
      "The link works once and only for a limited time. If it has expired, ask for a new one from the log in page. If you didn't ask for this, you can ignore this email and your password won't change.",
  });
  return { subject: "Reset your INSPIRE password", ...m };
}
