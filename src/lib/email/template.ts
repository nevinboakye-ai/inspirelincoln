/**
 * INSPIRE's branded email layout. Table based with inline styles so it
 * renders in Outlook, Gmail and Apple Mail, readable with images off, and
 * with a plain text version alongside. Used both for emails the site sends
 * and, through scripts/generate-email-templates.ts, for Supabase's
 * sign-up and password emails.
 */

export interface EmailContent {
  /** Short line shown after the subject in most inboxes. */
  preheader: string;
  eyebrow?: string;
  heading: string;
  /** Paragraphs of trusted text. Use `escapeHtml` on anything a person typed. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Optional block of details, shown as a ruled list. */
  details?: { label: string; value: string }[];
  /** Small print under the button, e.g. why they got the email. */
  footnote?: string;
  /** Absolute origin used for the crest image and footer links. */
  siteUrl: string;
}

const C = {
  midnight: "#0c182c",
  navy: "#1a3154",
  paper: "#f6f3ec",
  rule: "#ddd6c6",
  ink: "#0f1b2e",
  slate: "#555f6e",
  cyan: "#c9d8ec",
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function stripTags(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const crest = `${c.siteUrl}/brand/crest-white.png`;
  const p = (html: string) =>
    `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${html}</p>`;
  const details = c.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-top:1px solid ${C.rule};">
        ${c.details
          .map(
            (d) => `<tr>
              <td style="padding:12px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${C.slate};width:38%;vertical-align:top;">${escapeHtml(d.label)}</td>
              <td style="padding:12px 0;border-bottom:1px solid ${C.rule};font-family:${SANS};font-size:15px;color:${C.ink};vertical-align:top;">${escapeHtml(d.value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const button = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
        <tr><td style="background:${C.navy};border-radius:3px;">
          <a href="${c.cta.url}" style="display:inline-block;padding:15px 28px;font-family:${SANS};font-size:16px;font-weight:600;color:${C.paper};text-decoration:none;border-radius:3px;">${escapeHtml(c.cta.label)}</a>
        </td></tr>
      </table>
      <p style="margin:0 0 24px;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.slate};">If the button doesn't work, copy this link into your browser:<br><a href="${c.cta.url}" style="color:${C.navy};word-break:break-all;">${c.cta.url}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};">${escapeHtml(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
      <tr><td style="background:${C.midnight};padding:32px 32px 28px;border-radius:3px 3px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;padding-right:14px;"><img src="${crest}" width="40" height="47" alt="INSPIRE crest" style="display:block;border:0;"></td>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-family:${SERIF};font-size:24px;line-height:1;color:${C.paper};">Inspire</p>
            <p style="margin:6px 0 0;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${C.cyan};">Medical Research Conference</p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${C.midnight};padding:0 32px;"><div style="height:1px;background:#2a3d5c;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
      <tr><td style="background:#ffffff;padding:36px 32px 12px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
        ${c.eyebrow ? `<p style="margin:0 0 12px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:${C.slate};">${escapeHtml(c.eyebrow)}</p>` : ""}
        <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:30px;line-height:1.2;font-weight:normal;color:${C.ink};">${escapeHtml(c.heading)}</h1>
        ${c.paragraphs.map(p).join("\n")}
        ${details}
        ${button}
        ${c.footnote ? `<p style="margin:0 0 24px;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.slate};">${c.footnote}</p>` : ""}
      </td></tr>
      <tr><td style="background:${C.navy};padding:24px 32px;border-radius:0 0 3px 3px;">
        <p style="margin:0;font-family:${SERIF};font-style:italic;font-size:16px;color:${C.paper};">Digital Health: From Innovation to Evidence</p>
        <p style="margin:6px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.cyan};">Saturday 21 November 2026 · Lincoln Medical School, University of Lincoln</p>
        <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.cyan};">
          <a href="${c.siteUrl}" style="color:${C.paper};">inspirelincoln.uk</a> ·
          <a href="${c.siteUrl}/privacy" style="color:${C.paper};">Privacy</a> ·
          <a href="${c.siteUrl}/portal/profile" style="color:${C.paper};">Email preferences</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    "INSPIRE Medical Research Conference",
    "",
    c.heading,
    "",
    ...c.paragraphs.map((x) => stripTags(x) + "\n"),
    ...(c.details ?? []).map((d) => `${d.label}: ${d.value}`),
    ...(c.details?.length ? [""] : []),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ""] : []),
    ...(c.footnote ? [stripTags(c.footnote), ""] : []),
    "Saturday 21 November 2026, Lincoln Medical School, University of Lincoln",
    `${c.siteUrl}  ·  Privacy: ${c.siteUrl}/privacy`,
  ].join("\n");

  return { html, text };
}
