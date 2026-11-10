import "server-only";

/**
 * Sends an email through Resend's HTTP API. Returns false (never throws) when
 * Resend is not configured or the request fails, so callers can report
 * delivery status honestly.
 */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}) {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html, reply_to: replyTo }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email] Resend request failed", e);
    return false;
  }
}

/**
 * Sends many individual emails (each person only sees their own address)
 * through Resend's batch endpoint, 100 at a time. Returns how many were accepted.
 */
export async function sendBatch(messages: { to: string; subject: string; text: string; html?: string; replyTo?: string }[]) {
  if (!emailConfigured()) return 0;
  let delivered = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html, reply_to: m.replyTo }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (res.ok) delivered += chunk.length;
      else console.error("[email] Resend batch error", res.status, await res.text());
    } catch (e) {
      console.error("[email] Resend batch failed", e);
    }
  }
  return delivered;
}
