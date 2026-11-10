"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { ActionResult } from "@/app/portal/actions";
import { currentEditionId } from "@/lib/admin/server";

const REG_STATUSES = ["pending", "confirmed", "waitlisted", "cancelled"];
const ROLES = ["delegate", "reviewer", "editor", "admin"];

export async function addRegistration(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/registrations");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const status = String(form.get("status") ?? "confirmed");
  const reference = String(form.get("reference") ?? "").trim().slice(0, 120) || null;
  if (!REG_STATUSES.includes(status)) return { ok: false, error: "Choose a status." };
  const { data: profile } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!profile) return { ok: false, fieldErrors: { email: "No account uses this email. Ask the delegate to create an account first." } };
  const edition = await currentEditionId(db);
  const { error } = await db.from("registrations").insert({ edition_id: edition, user_id: profile.id, status, source: "manual", external_reference: reference });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "This person is already registered." : "Could not add the registration." };
  revalidatePath("/admin/registrations");
  return { ok: true, message: `Registration added for ${email}.` };
}

export async function setRegistrationStatus(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/registrations");
  const status = String(form.get("status"));
  if (!REG_STATUSES.includes(status)) return { ok: false, error: "Invalid status." };
  const { error } = await db.from("registrations").update({ status }).eq("id", String(form.get("id")));
  if (error) return { ok: false, error: "Could not update." };
  revalidatePath("/admin/registrations");
  return { ok: true, message: "Updated." };
}

export type CheckInResult = { ok: boolean; error?: string; name?: string | null; status?: string; already?: boolean; at?: string | null } | null;

export async function checkIn(_: CheckInResult, form: FormData): Promise<CheckInResult> {
  const { db } = await requireRole(["admin"], "/admin/checkin");
  const raw = String(form.get("token") ?? "").trim();
  const token = raw.replace(/^INSPIRE-CHECKIN:/i, "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, error: "That isn't a valid INSPIRE check-in code." };
  const { data, error } = await db.rpc("check_in", { token });
  if (error) return { ok: false, error: "Check-in failed. Please try again." };
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return { ok: false, error: "No registration found for this code." };
  revalidatePath("/admin/checkin");
  if (r.status !== "confirmed") return { ok: false, name: r.full_name, status: r.status, error: `Registration is ${r.status}, not confirmed.` };
  return { ok: true, name: r.full_name, status: r.status, already: r.already_checked_in, at: r.checked_in_at };
}

export async function setRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireRole(["admin"], "/admin/users");
  if (!profile.access.owner) return { ok: false, error: "Only the site owner can change site roles." };
  const id = String(form.get("id"));
  const role = String(form.get("role"));
  if (!ROLES.includes(role)) return { ok: false, error: "Invalid role." };
  if (id === user.id && role !== "admin" && profile.siteRole === "admin") return { ok: false, error: "You can't remove your own site owner access." };
  const { error } = await db.from("profiles").update({ role }).eq("id", id);
  if (error) return { ok: false, error: "Could not change the role." };
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated." };
}

export async function updateEnquiry(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/enquiries");
  const id = String(form.get("id"));
  if (form.get("intent") === "delete") {
    const { error } = await db.from("contact_enquiries").delete().eq("id", id);
    if (error) return { ok: false, error: "Could not delete." };
  } else {
    const status = String(form.get("status"));
    if (!["new", "in_progress", "closed"].includes(status)) return { ok: false, error: "Invalid status." };
    const { error } = await db.from("contact_enquiries").update({ status }).eq("id", id);
    if (error) return { ok: false, error: "Could not update." };
  }
  revalidatePath("/admin/enquiries");
  return { ok: true, message: "Saved." };
}

export async function reviewPoster(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireRole(["admin"], "/admin/posters");
  const status = String(form.get("status"));
  if (!["received", "approved", "needs_changes"].includes(status)) return { ok: false, error: "Invalid status." };
  const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
  const { error } = await db.from("poster_uploads").update({ status, admin_note: note }).eq("id", String(form.get("id")));
  if (error) return { ok: false, error: "Could not update." };
  revalidatePath("/admin/posters");
  return { ok: true, message: "Saved." };
}
