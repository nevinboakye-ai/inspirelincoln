"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { ASSIGNMENT_ROLES, type AssignmentRole } from "@/lib/day/plan";

export type FormResult = { ok: boolean; message?: string; error?: string } | null;

const PATH = "/admin/on-the-day";
const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9-]+$/;

const friendly = (m: string, fallback: string) =>
  m.includes("VIEW_AS") || m.includes("read only")
    ? "You're viewing as someone else, so changes are switched off."
    : /permission|row-level|policy/i.test(m)
      ? "You don't have permission to change this."
      : /does not exist|could not find/i.test(m)
        ? "This isn't set up yet: run setup SQL 42 in Supabase."
        : fallback;

async function editionId(db: Awaited<ReturnType<typeof requireAccess>>["db"]) {
  const { data } = await db.from("editions").select("id").eq("is_current", true).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Turns the automatic "where to go next" alerts on or off, and sets how early they show. */
export async function saveAlertSettings(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, user } = await requireAccess("live_alerts", PATH);
  const lead = Number(form.get("lead_minutes"));
  if (!Number.isInteger(lead) || lead < 2 || lead > 45) return { ok: false, error: "Choose between 2 and 45 minutes." };
  const ed = await editionId(db);
  if (!ed) return { ok: false, error: "No conference is set as the current one." };
  const { error } = await db
    .from("live_alert_settings")
    .upsert({ edition_id: ed, auto_enabled: form.get("auto") === "on", lead_minutes: lead, updated_at: new Date().toISOString(), updated_by: user.id });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save that. Please try again.") };
  revalidatePath(PATH);
  return { ok: true, message: form.get("auto") === "on" ? `Saved. Alerts show ${lead} minutes before each part starts.` : "Saved. Automatic alerts are off." };
}

/** Sends an alert to every screen now, for a few minutes. */
export async function sendAlert(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, user } = await requireAccess("live_alerts", PATH);
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const place = String(form.get("place") ?? "").trim();
  const mapSlug = String(form.get("map_slug") ?? "").trim();
  const audience = String(form.get("audience") ?? "everyone");
  const minutes = Number(form.get("minutes"));
  if (title.length < 2 || title.length > 90) return { ok: false, error: "Give the alert a headline of up to 90 characters." };
  if (body.length > 300) return { ok: false, error: "Keep the message to 300 characters." };
  if (place.length > 90) return { ok: false, error: "Keep the place to 90 characters." };
  if (mapSlug && !SLUG.test(mapSlug)) return { ok: false, error: "Choose a place from the list." };
  if (!["everyone", "signed_in", "committee"].includes(audience)) return { ok: false, error: "Choose who sees it." };
  if (![5, 10, 15, 30, 60, 120].includes(minutes)) return { ok: false, error: "Choose how long it stays live." };
  const now = new Date();
  const { error } = await db.from("live_alerts").insert({
    edition_id: await editionId(db),
    title,
    body: body || null,
    place: place || null,
    map_slug: mapSlug || null,
    audience,
    starts_at: now.toISOString(),
    ends_at: new Date(now.getTime() + minutes * 60_000).toISOString(),
    created_by: user.id,
  });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't send that. Please try again.") };
  revalidatePath(PATH);
  return { ok: true, message: "Sent. It shows on every open page within 30 seconds, and to anyone who opens a page while it's live." };
}

/** Ends a live alert early. People who already saw it have dismissed it; nobody new sees it. */
export async function stopAlert(id: string): Promise<FormResult> {
  const { db } = await requireAccess("live_alerts", PATH);
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { error } = await db.from("live_alerts").update({ ends_at: new Date().toISOString() }).eq("id", id).gt("ends_at", new Date().toISOString());
  if (error) return { ok: false, error: friendly(error.message, "We couldn't stop that alert.") };
  revalidatePath(PATH);
  return { ok: true, message: "Stopped." };
}

/** Puts one person in one session, for example an oral presenter in their room. */
export async function addAssignment(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, user } = await requireAccess(["live_alerts", "allocate_workshops"], PATH);
  const userId = String(form.get("user_id") ?? "");
  const sessionId = String(form.get("session_id") ?? "");
  const role = String(form.get("role") ?? "attending") as AssignmentRole;
  const note = String(form.get("note") ?? "").trim();
  if (!UUID.test(userId)) return { ok: false, error: "Choose a person first." };
  if (!UUID.test(sessionId)) return { ok: false, error: "Choose a session." };
  if (!ASSIGNMENT_ROLES.includes(role)) return { ok: false, error: "Choose what they're doing." };
  if (note.length > 200) return { ok: false, error: "Keep the note to 200 characters." };
  const ed = await editionId(db);
  if (!ed) return { ok: false, error: "No conference is set as the current one." };
  // Only one of the sessions that run at the same time: placing someone in one takes them out of the other.
  const { data: s } = await db.from("sessions").select("starts_at").eq("id", sessionId).maybeSingle();
  if (s?.starts_at) {
    const { data: same } = await db.from("sessions").select("id").eq("edition_id", ed).eq("starts_at", s.starts_at).neq("id", sessionId);
    const others = (same ?? []).map((x) => x.id as string);
    if (others.length) await db.from("programme_assignments").delete().eq("user_id", userId).in("session_id", others);
  }
  const { error } = await db
    .from("programme_assignments")
    .upsert({ edition_id: ed, user_id: userId, session_id: sessionId, role, note: note || null, created_by: user.id }, { onConflict: "user_id,session_id" });
  if (error) return { ok: false, error: friendly(error.message, "We couldn't save that. Please try again.") };
  revalidatePath(PATH);
  revalidatePath("/portal/my-day");
  return { ok: true, message: "Saved. It shows in their day straight away." };
}

export async function removeAssignment(id: string): Promise<FormResult> {
  const { db } = await requireAccess(["live_alerts", "allocate_workshops"], PATH);
  if (!UUID.test(id)) return { ok: false, error: "Something went wrong." };
  const { error } = await db.from("programme_assignments").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message, "We couldn't remove that.") };
  revalidatePath(PATH);
  return { ok: true, message: "Removed." };
}

export type PersonHit = { id: string; full_name: string | null; institution: string | null; roles: string[] };

/** Find someone to place in a session. */
export async function findPeople(q: string): Promise<PersonHit[]> {
  const { db } = await requireAccess(["live_alerts", "allocate_workshops"], PATH);
  const query = String(q ?? "").trim().slice(0, 120);
  if (query.length < 2) return [];
  const { data } = await db.rpc("day_search", { q: query });
  return ((data ?? []) as PersonHit[]).slice(0, 12);
}
