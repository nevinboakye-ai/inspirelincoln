/** Enquiries members send the committee from My Hub. Mirrors public.enquiry_threads and enquiry_messages. */

export const ENQUIRY_TOPICS = {
  question: { label: "A question", hint: "About the day, the programme or your place" },
  request: { label: "A request", hint: "Something you'd like the committee to do or change" },
  technical: { label: "Technical help", hint: "Signing in, uploads or something not working" },
  access: { label: "Access or dietary needs", hint: "Adjustments that would help you on the day" },
  presenting: { label: "Presenting", hint: "Your slides, poster or presentation slot" },
  other: { label: "Something else", hint: "Anything that doesn't fit above" },
} as const;
export type EnquiryTopic = keyof typeof ENQUIRY_TOPICS;
export const isTopic = (t: unknown): t is EnquiryTopic => typeof t === "string" && t in ENQUIRY_TOPICS;

export type EnquiryStatus = "open" | "answered" | "closed";

export type EnquiryThread = {
  id: string;
  user_id: string;
  topic: EnquiryTopic;
  subject: string;
  status: EnquiryStatus;
  last_from: "member" | "committee";
  last_message_at: string;
  member_read_at: string | null;
  committee_read_at: string | null;
  created_at: string;
};

export type EnquiryMessage = {
  id: string;
  thread_id: string;
  author_id: string | null;
  author_name: string;
  from_committee: boolean;
  body: string;
  created_at: string;
};

export const SUBJECT_MAX = 120;
export const BODY_MAX = 4000;
/** What the committee promises. Shown wherever members write in. */
export const REPLY_PROMISE = "The committee will reply within 48 hours.";

export const THREAD_COLUMNS = "id, user_id, topic, subject, status, last_from, last_message_at, member_read_at, committee_read_at, created_at";
export const MESSAGE_COLUMNS = "id, thread_id, author_id, author_name, from_committee, body, created_at";

/** Unread for the member: the committee has written since they last looked. */
export const unreadForMember = (t: Pick<EnquiryThread, "last_from" | "last_message_at" | "member_read_at">) =>
  t.last_from === "committee" && (!t.member_read_at || t.member_read_at < t.last_message_at);

/** Waiting on the committee: the member wrote last and it isn't closed. */
export const needsReply = (t: Pick<EnquiryThread, "status" | "last_from">) => t.status !== "closed" && t.last_from === "member";

/** Status as the member sees it. */
export function memberStatus(t: Pick<EnquiryThread, "status" | "last_from">): { label: string; tone: "warning" | "success" | "neutral" } {
  if (t.status === "closed") return { label: "Closed", tone: "neutral" };
  return t.last_from === "committee" ? { label: "Replied", tone: "success" } : { label: "Waiting for a reply", tone: "warning" };
}

const LONDON = "Europe/London";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: LONDON });

/** "14:05" for today, "Yesterday", "Mon", or "3 Nov". */
export function shortWhen(iso: string, now = new Date()) {
  const d = new Date(iso);
  const today = dayKey(now.toISOString());
  const k = dayKey(iso);
  if (k === today) return d.toLocaleTimeString("en-GB", { timeZone: LONDON, hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (k === dayKey(y.toISOString())) return "Yesterday";
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return d.toLocaleDateString("en-GB", { timeZone: LONDON, weekday: "short" });
  return d.toLocaleDateString("en-GB", { timeZone: LONDON, day: "numeric", month: "short" });
}

/** Heading between days in a conversation: "Today", "Yesterday" or "Monday 3 November". */
export function dayLabel(iso: string, now = new Date()) {
  const k = dayKey(iso);
  if (k === dayKey(now.toISOString())) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (k === dayKey(y.toISOString())) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: LONDON, weekday: "long", day: "numeric", month: "long" });
}
export const sameDay = (a: string, b: string) => dayKey(a) === dayKey(b);

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: LONDON, hour: "2-digit", minute: "2-digit" });
