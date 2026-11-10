/**
 * Writes INSPIRE-branded HTML for Supabase's authentication emails into
 * supabase/templates/. Paste each file into Supabase: Authentication, then
 * Emails (Templates). They use Supabase's Go template variables, and link to
 * /auth/confirm with a token hash so links work in any browser.
 *
 * Run with: npx tsx scripts/generate-email-templates.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderEmail } from "../src/lib/email/template";

const SITE = "{{ .SiteURL }}";
const out = join(process.cwd(), "supabase", "templates");
mkdirSync(out, { recursive: true });

const confirm = (type: string, next: string) => `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}&next=${next}`;

const templates: { file: string; subject: string; html: string }[] = [
  {
    file: "confirm-signup.html",
    subject: "Confirm your INSPIRE account",
    html: renderEmail({
      siteUrl: SITE,
      preheader: "One tap to verify your email and finish registering for INSPIRE.",
      eyebrow: "Verify your email",
      heading: "Welcome to INSPIRE",
      paragraphs: [
        "Thank you for registering for INSPIRE. Please confirm this is your email address so we can set up your account.",
        "Once you've confirmed it, the executive committee will review your account. We'll email you as soon as it's approved, or if you're placed on the waitlist.",
      ],
      cta: { label: "Confirm my email", url: confirm("email", "/portal?welcome=1") },
      footnote: "If you didn't register for INSPIRE, you can ignore this email and no account will be created.",
    }).html,
  },
  {
    file: "reset-password.html",
    subject: "Reset your INSPIRE password",
    html: renderEmail({
      siteUrl: SITE,
      preheader: "Choose a new password for your INSPIRE account.",
      eyebrow: "Password reset",
      heading: "Choose a new password",
      paragraphs: ["We received a request to reset the password for your INSPIRE account. The link below works once and expires after an hour."],
      cta: { label: "Reset my password", url: confirm("recovery", "/auth/update-password") },
      footnote: "If you didn't ask for this, you can ignore this email. Your password won't change.",
    }).html,
  },
  {
    file: "magic-link.html",
    subject: "Your INSPIRE sign-in link",
    html: renderEmail({
      siteUrl: SITE,
      preheader: "Sign in to your INSPIRE account.",
      eyebrow: "Sign in",
      heading: "Your sign-in link",
      paragraphs: ["Use the button below to sign in to your INSPIRE account. The link works once and expires after an hour."],
      cta: { label: "Sign in to INSPIRE", url: confirm("magiclink", "/portal") },
      footnote: "If you didn't ask to sign in, you can ignore this email.",
    }).html,
  },
  {
    file: "change-email.html",
    subject: "Confirm your new email address",
    html: renderEmail({
      siteUrl: SITE,
      preheader: "Confirm the new email address for your INSPIRE account.",
      eyebrow: "Email change",
      heading: "Confirm your new email",
      paragraphs: ["You asked to change the email address on your INSPIRE account from {{ .Email }} to {{ .NewEmail }}. Please confirm the change."],
      cta: { label: "Confirm new email", url: confirm("email_change", "/portal/profile") },
      footnote: "If you didn't ask for this change, please reply to this email straight away.",
    }).html,
  },
  {
    file: "invite.html",
    subject: "You're invited to INSPIRE",
    html: renderEmail({
      siteUrl: SITE,
      preheader: "The INSPIRE committee has invited you to create an account.",
      eyebrow: "Invitation",
      heading: "You're invited",
      paragraphs: ["The INSPIRE committee has invited you to create an account for the National Medical Research Conference."],
      cta: { label: "Accept the invitation", url: confirm("invite", "/auth/update-password") },
      footnote: "If you weren't expecting this, you can ignore this email.",
    }).html,
  },
  {
    file: "reauthentication.html",
    subject: "Your INSPIRE confirmation code",
    html: renderEmail({
      siteUrl: SITE,
      preheader: "Your one-time confirmation code.",
      eyebrow: "Confirm it's you",
      heading: "Your confirmation code",
      paragraphs: [
        "Enter this code to confirm it's you:",
        '<span style="font-family:Georgia,serif;font-size:32px;letter-spacing:6px;color:#0f1b2e;">{{ .Token }}</span>',
      ],
      footnote: "If you didn't ask for a code, you can ignore this email.",
    }).html,
  },
];

for (const t of templates) writeFileSync(join(out, t.file), t.html);
writeFileSync(
  join(out, "SUBJECTS.md"),
  `# Email subjects\n\nUse these subjects with each template in Supabase (Authentication, Emails).\n\n${templates.map((t) => `- ${t.file}: ${t.subject}`).join("\n")}\n`,
);
console.log(`Wrote ${templates.length} templates to ${out}`);
