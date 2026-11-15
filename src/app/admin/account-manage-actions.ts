"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { requireAccess } from "@/lib/auth";
import { EXEC_TYPES, rolesOf } from "@/lib/accounts";
import { REQUEST_KEYS, accountRemovedEmail, requestEmail, type RequestItem } from "@/lib/accounts/requests";
import { STAFF_PEOPLE_COLUMNS, selectPeople } from "@/lib/admin/people";
import { sendEmail } from "@/lib/email/resend";
import { SITE_URL } from "@/lib/site";
import type { AccountType, UserRole } from "@/lib/types";
import type { ActionResult } from "@/app/portal/actions";

/**
 * Managing one person from anywhere on the site (their account page, the
 * platform dashboard or the delegate network): removing their account,
 * correcting their name, and asking them to do things in My Hub.
 *
 * Every action checks the permission here, and the database checks it again.
 */

type Person = {
  id: string;
  email: string;
  full_name: string | null;
  account_type: AccountType;
  extra_types: AccountType[] | null;
  role: UserRole;
};

/** Someone with an account, or someone on the selected list who hasn't set one up yet. */
const target = z.object({ kind: z.enum(["account", "list"]), id: z.string().uuid() });

const PRIVATE_BUCKETS = ["submissions", "posters", "abstracts", "avatars"] as const;

/** Every file in someone's private folders (their own folder and one level of subfolders). */
async function filesOf(store: SupabaseClient, bucket: string, id: string) {
  const out: string[] = [];
  const { data } = await store.storage.from(bucket).list(id, { limit: 1000 });
  for (const f of data ?? []) {
    if (f.id) out.push(`${id}/${f.name}`);
    else {
      const { data: inner } = await store.storage.from(bucket).list(`${id}/${f.name}`, { limit: 1000 });
      for (const g of inner ?? []) if (g.id) out.push(`${id}/${f.name}/${g.name}`);
    }
  }
  return out;
}

async function loadPerson(db: SupabaseClient, id: string) {
  const [p] = await selectPeople<Person>(db, STAFF_PEOPLE_COLUMNS, (q) => q.eq("id", id).limit(1));
  return p ?? null;
}

const removeSchema = z.object({
  id: z.string().uuid(),
  confirm: z.string().trim(),
  unlist: z.boolean(),
  notify: z.boolean(),
  reason: z.string().trim().max(1000, "Keep the note under 1000 characters.").optional().default(""),
});

/**
 * Permanently removes someone's account: their files first, then the account
 * and everything linked to it. Optionally takes them off the selected list
 * (so their place can go to someone else) and emails them.
 */
export async function removeAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireAccess("remove_accounts", "/admin/accounts");
  const parsed = removeSchema.safeParse({
    id: form.get("id"),
    confirm: form.get("confirm") ?? "",
    unlist: form.get("unlist") === "on",
    notify: form.get("notify") === "on",
    reason: form.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please check the form.", fieldErrors: { reason: parsed.error.issues[0]?.message ?? "" } };
  const v = parsed.data;
  if (v.confirm.toUpperCase() !== "REMOVE") return { ok: false, fieldErrors: { confirm: "Type REMOVE to confirm." } };
  if (v.id === user.id) return { ok: false, error: "You can't remove your own account here. Use Profile and privacy in My Hub instead." };

  const person = await loadPerson(db, v.id);
  if (!person) return { ok: false, error: "This account no longer exists." };
  if (person.role === "admin") return { ok: false, error: "The site owner's account can't be removed." };
  if (rolesOf(person.account_type, person.extra_types).some((t) => EXEC_TYPES.includes(t)) && !profile.access.leadership)
    return { ok: false, error: "Only the president or vice president can remove an executive committee account." };

  // Files first: the database can't delete them, and nothing points to them once the account is gone.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = key ? createAdminClient(SUPABASE_URL, key, { auth: { persistSession: false } }) : null;
  const store = (admin ?? db) as SupabaseClient;
  for (const bucket of PRIVATE_BUCKETS) {
    const paths = await filesOf(store, bucket, v.id).catch(() => []);
    if (paths.length) await store.storage.from(bucket).remove(paths);
  }

  const { error } = await db.rpc("remove_account", { target: v.id, unlist: v.unlist });
  if (error) {
    const missing = error.code === "PGRST202" || error.code === "42883";
    if (missing && admin && profile.access.owner) {
      // Before setup file 41: the site owner can still remove accounts with the service key.
      if (v.unlist) await db.from("delegate_roster").delete().eq("email", person.email.toLowerCase());
      const { error: e } = await admin.auth.admin.deleteUser(v.id);
      if (e) return { ok: false, error: "Could not remove the account. Run setup file 41 in Supabase, then try again." };
    } else {
      const msg = missing
        ? "Removing accounts needs setup file 41. Run it in the Supabase SQL editor, then try again."
        : /LEADERSHIP_ONLY/.test(error.message)
          ? "Only the president or vice president can remove an executive committee account."
          : /SITE_OWNER/.test(error.message)
            ? "The site owner's account can't be removed."
            : /NOT_FOUND/.test(error.message)
              ? "This account no longer exists."
              : /NOT_ALLOWED/.test(error.message)
                ? "You don't have permission to remove accounts."
                : "Could not remove the account. Please try again.";
      return { ok: false, error: msg };
    }
  }

  if (v.notify && person.email) {
    await sendEmail({ to: person.email, replyTo: user.email ?? undefined, ...accountRemovedEmail({ siteUrl: SITE_URL, name: person.full_name, reason: v.reason || null }) });
  }

  for (const path of ["/admin/accounts", "/admin/accounts/roster", "/admin/platform", "/portal/network", "/admin"]) revalidatePath(path);
  const name = person.full_name || person.email;
  return { ok: true, message: `${name}'s account has been removed${v.unlist ? " and they're off the selected list" : ""}.` };
}

const renameSchema = target.extend({
  fullName: z.string().trim().min(2, "Enter their name.").max(120, "Keep it under 120 characters."),
  institution: z.string().trim().max(160, "Keep it under 160 characters.").optional().default(""),
  yearOfStudy: z.string().trim().max(40, "Keep it under 40 characters.").optional().default(""),
});

/** Corrects someone's name, university or year, for an account or a selected-list entry. */
export async function renamePerson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, profile } = await requireAccess("review_accounts", "/portal/network");
  const parsed = renameSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = parsed.data;
  const changes = { full_name: v.fullName, institution: v.institution || null, year_of_study: v.yearOfStudy || null };

  if (v.kind === "account") {
    const person = await loadPerson(db, v.id);
    if (!person) return { ok: false, error: "This account no longer exists." };
    if (person.role === "admin" && !profile.access.owner) return { ok: false, error: "Only the site owner can change the site owner's account." };
    const { error } = await db.from("profiles").update(changes).eq("id", v.id);
    if (error) return { ok: false, error: /executive/i.test(error.message) ? "Only the president or vice president can change executive committee accounts." : "Could not save their details." };
    revalidatePath(`/admin/accounts/${v.id}`);
  } else {
    const { error, count } = await db.from("delegate_roster").update(changes, { count: "exact" }).eq("id", v.id);
    if (error) return { ok: false, error: "Could not save their details." };
    if (!count) return { ok: false, error: "This person is no longer on the selected list." };
    revalidatePath(`/admin/accounts/selected/${v.id}`);
  }
  revalidatePath("/portal/network");
  revalidatePath("/admin/accounts");
  return { ok: true, message: `Saved. They now show as ${v.fullName}.` };
}

/** Takes someone who hasn't set up an account yet off the selected list. */
export async function removeFromList(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db } = await requireAccess("review_accounts", "/portal/network");
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, error: "That person couldn't be found." };
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "REMOVE") return { ok: false, fieldErrors: { confirm: "Type REMOVE to confirm." } };
  const { error, count } = await db.from("delegate_roster").delete({ count: "exact" }).eq("id", id.data);
  if (error) return { ok: false, error: "Could not take them off the list." };
  if (!count) return { ok: false, error: "They're no longer on the list." };
  revalidatePath("/portal/network");
  revalidatePath("/admin/accounts/roster");
  return { ok: true, message: "Taken off the selected list. Their place can go to someone else." };
}

const requestSchema = target.extend({
  items: z.array(z.enum(REQUEST_KEYS as [RequestItem, ...RequestItem[]])).min(1, "Choose at least one thing to ask for.").max(REQUEST_KEYS.length),
  note: z.string().trim().max(1500, "Keep the note under 1500 characters.").optional().default(""),
  deadline: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Choose a date.")
    .optional()
    .default(""),
});

/** Emails one person a short, branded list of things to do in My Hub, by a date if given. */
export async function sendPersonRequest(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { db, user, profile } = await requireAccess(["send_email", "review_accounts"], "/portal/network");
  const parsed = requestSchema.safeParse({
    kind: form.get("kind"),
    id: form.get("id"),
    items: form.getAll("items").map(String),
    note: form.get("note") ?? "",
    deadline: form.get("deadline") ?? "",
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { ok: false, error: fe.items ?? "Please check the highlighted fields.", fieldErrors: fe };
  }
  const v = parsed.data;

  let to: { email: string; name: string | null } | null = null;
  if (v.kind === "account") {
    const p = await loadPerson(db, v.id);
    if (p) to = { email: p.email, name: p.full_name };
  } else {
    const { data } = await db.from("delegate_roster").select("email, full_name").eq("id", v.id).maybeSingle();
    if (data) to = { email: data.email, name: data.full_name };
  }
  if (!to?.email) return { ok: false, error: "That person couldn't be found." };

  // People on the list who haven't joined yet need to sign in first.
  const items = v.kind === "list" && !v.items.includes("sign_in") ? (["sign_in", ...v.items] as RequestItem[]) : v.items;
  const sender = profile.fullName || "The INSPIRE committee";
  const mail = requestEmail({ siteUrl: SITE_URL, name: to.name, items, note: v.note || null, deadline: v.deadline || null, sender });
  const ok = await sendEmail({ to: to.email, replyTo: user.email ?? undefined, ...mail });
  if (!ok) return { ok: false, error: "Email isn't set up yet. Add the Resend settings in Vercel first." };

  // Kept with the other emails sent from the dashboard (only recorded for people who can send emails).
  await db.from("email_broadcasts").insert({
    sent_by: user.id,
    sender_name: sender,
    subject: mail.subject,
    body: [...items.map((k, i) => `${i + 1}. ${k}`), v.note].filter(Boolean).join("\n"),
    purpose: "service",
    audience_types: [],
    audience_statuses: [],
    recipient_email: to.email,
    recipient_count: 1,
    delivered_count: 1,
  });
  return { ok: true, message: `Sent to ${to.name || to.email}.` };
}
