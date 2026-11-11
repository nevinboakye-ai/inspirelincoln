/**
 * "View as" lets the site owner see the site exactly as another account
 * holder does, using a real, short-lived session for that account. The
 * session lives only in an encrypted, httpOnly cookie in the owner's browser
 * and is read only: every write is refused while it is active.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const VIEW_AS_COOKIE = "inspire_view_as";
/** Readable by the page, so the banner can say who you're viewing as. Holds the name only. */
export const VIEW_AS_WHO_COOKIE = "inspire_view_as_who";

export interface ViewAsPayload {
  /** The owner who started it. */
  o: string;
  /** The account being viewed. */
  t: string;
  /** That account's session. */
  a: string;
  r: string;
  /** When the session ends, in seconds since 1970. */
  e: number;
  n: string;
}

function key() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createHash("sha256").update(`inspire-view-as:${secret}`).digest();
}

export const viewAsAvailable = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export function sealViewAs(p: ViewAsPayload) {
  const k = key();
  if (!k) throw new Error("View as needs SUPABASE_SERVICE_ROLE_KEY");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(JSON.stringify(p), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/** Returns the payload if the cookie is genuine and the session hasn't ended. */
export function openViewAs(value: string | undefined): ViewAsPayload | null {
  const k = key();
  if (!value || !k) return null;
  try {
    const [iv, tag, body] = value.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", k, iv);
    d.setAuthTag(tag);
    const p = JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8")) as ViewAsPayload;
    if (!p.o || !p.t || !p.a || p.e * 1000 < Date.now() + 15_000) return null;
    return p;
  } catch {
    return null;
  }
}

/** Database functions that only read, so they still work while viewing as someone. */
const READ_ONLY_RPC = new Set([
  "audience_counts", "broadcast_recipients", "checkin_counts", "email_directory", "has_access", "my_access",
  "enquiry_people", "my_waitlist_position", "network_directory", "selected_recipients", "selected_waiting_count", "submission_presenter",
]);

/** A fetch for the viewed account's Supabase client that lets reads through and refuses every write. */
export const readOnlyFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const p = url.pathname;
  const ok =
    method === "GET" || method === "HEAD" ||
    (method === "POST" && p.startsWith("/rest/v1/rpc/") && READ_ONLY_RPC.has(p.slice("/rest/v1/rpc/".length))) ||
    (method === "POST" && p.startsWith("/storage/v1/object/sign/"));
  if (ok) return fetch(input, init);
  return new Response(JSON.stringify({ code: "VIEW_AS", message: "Read only while viewing as someone", details: null, hint: null }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
};
