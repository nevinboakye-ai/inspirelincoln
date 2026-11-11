"use server";
import { revalidatePath } from "next/cache";
import { requireAccess, requireRole } from "@/lib/auth";
import type { ActionResult } from "@/app/portal/actions";
import { currentEditionId } from "@/lib/admin/server";
import { EXEC_TYPES, rolesOf, splitRoles } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

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

export async function setRole(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireAccess("owner", "/admin/users");
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

/* ---------- Selected delegate list ---------- */

export async function addRosterEntry(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, profile } = await requireAccess("review_accounts", "/admin/accounts/roster");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const fullName = String(form.get("fullName") ?? "").trim().slice(0, 120);
  const roles = splitRoles(form.getAll("types").map(String));
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { ok: false, fieldErrors: { email: "Enter a valid email address." } };
  if (fullName.length < 2) return { ok: false, fieldErrors: { fullName: "Enter their name." } };
  if ("error" in roles) return { ok: false, error: roles.error };
  if (rolesOf(roles.main, roles.extra).some((t: AccountType) => EXEC_TYPES.includes(t)) && !profile.access.leadership)
    return { ok: false, error: "Only the president or vice president can add someone as executive committee." };
  const { error } = await db.from("delegate_roster").upsert({
    email,
    full_name: fullName,
    institution: String(form.get("institution") ?? "").trim().slice(0, 160) || null,
    year_of_study: String(form.get("year") ?? "").trim().slice(0, 40) || null,
    account_type: roles.main,
    // Only sent when needed, so adding a delegate still works before setup file 21.
    ...(roles.extra.length ? { extra_types: roles.extra } : {}),
  });
  if (error)
    return {
      ok: false,
      error: /extra_types/i.test(error.message)
        ? "The database can't store more than one role yet. Run setup file 21 in Supabase, then try again."
        : /check constraint/i.test(error.message)
        ? "The database can't store committee types on the selected list yet. Run setup file 20 in Supabase, then try again."
        : "Could not add this person.",
    };
  revalidatePath("/admin/accounts/roster");
  revalidatePath("/admin/accounts");
  return { ok: true, message: `${fullName} is on the list. If they already have an account it is now approved.` };
}

export async function removeRosterEntry(form: FormData) {
  const { db } = await requireAccess("review_accounts", "/admin/accounts/roster");
  await db.from("delegate_roster").delete().eq("email", String(form.get("email") ?? "").toLowerCase());
  revalidatePath("/admin/accounts/roster");
}
