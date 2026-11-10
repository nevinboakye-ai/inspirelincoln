"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
import { EXEC_TYPES, rolesLabel, rolesOf, splitRoles } from "@/lib/accounts";
import { sendEmail } from "@/lib/email/resend";
import { rolesChangedEmail } from "@/lib/email/messages";
import { SITE_URL } from "@/lib/site";
import type { AccountType } from "@/lib/types";
import type { ActionResult } from "@/app/portal/actions";

const EXEC_ONLY = "Only the president or vice president can add or remove executive committee roles.";
const NEEDS_SETUP = "The database can't store more than one role yet. Run setup file 21 in Supabase, then try again.";

const same = (a: AccountType[], b: AccountType[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/**
 * Set every role someone holds, from the Accounts list, their account page or
 * the selected list. The most senior role becomes their main one.
 */
export async function setRoles(input: { id: string; kind: "account" | "roster"; types: string[]; notify?: boolean }): Promise<ActionResult> {
  const { db, user, profile } = await requireAccess("review_accounts", input.kind === "roster" ? "/admin/accounts/roster" : "/admin/accounts");
  if (!z.string().uuid().safeParse(input.id).success || !Array.isArray(input.types)) return { ok: false, error: "Choose at least one role." };
  const split = splitRoles(input.types.map(String));
  if ("error" in split) return { ok: false, error: split.error };
  const next = rolesOf(split.main, split.extra);
  const canLead = profile.access.leadership;
  const table = input.kind === "roster" ? "delegate_roster" : "profiles";

  // "*" so this still works, with a clear message, before setup file 21 adds extra_types.
  const { data: current } = await db.from(table).select("*").eq("id", input.id).maybeSingle();
  if (!current) return { ok: false, error: input.kind === "roster" ? "This person is no longer on the list." : "Account not found." };
  const before = rolesOf(current.account_type as AccountType, (current.extra_types as AccountType[] | undefined) ?? []);
  if (same(before, next)) return { ok: true, message: "No change to save." };
  if (split.extra.length && !("extra_types" in current)) return { ok: false, error: NEEDS_SETUP };

  if (input.kind === "account") {
    if (input.id === user.id && !canLead) return { ok: false, error: "You can't change your own roles." };
    if (current.role === "admin" && !profile.access.owner) return { ok: false, error: "Only the site owner can change the site owner's account." };
  }
  if ([...before, ...next].some((t) => EXEC_TYPES.includes(t)) && !canLead) return { ok: false, error: EXEC_ONLY };

  const patch = "extra_types" in current ? { account_type: split.main, extra_types: split.extra } : { account_type: split.main };
  const { data: saved, error } = await db.from(table).update(patch).eq("id", input.id).select("id");
  if (error || !saved?.length) {
    const msg = error?.message ?? "";
    return {
      ok: false,
      error: /invalid input value for enum/i.test(msg)
        ? "The database doesn't know one of these roles yet. Run the committee teams setup SQL (files 14 and 15) in Supabase, then try again."
        : /executive|leadership|president/i.test(msg)
          ? EXEC_ONLY
          : /check constraint/i.test(msg)
            ? "The database can't store committee roles on the selected list yet. Run setup file 20 in Supabase, then try again."
            : /extra_types/i.test(msg)
              ? NEEDS_SETUP
              : "Could not save their roles.",
    };
  }

  let emailed: boolean | null = null;
  if (input.kind === "account" && input.notify) {
    if (current.account_status !== "approved") emailed = null;
    else {
      const mail = rolesChangedEmail({ siteUrl: SITE_URL, name: current.full_name, types: next });
      emailed = mail ? await sendEmail({ to: current.email, ...mail }) : false;
    }
  }

  revalidatePath("/admin/accounts", "layout");
  revalidatePath("/admin/platform", "layout");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
  const label = rolesLabel(next);
  return {
    ok: true,
    message:
      input.kind === "roster"
        ? `Saved: ${label}. They'll have ${next.length > 1 ? "these roles" : "this role"} when they set up their account.`
        : `Saved: ${label}.${
            input.notify ? (current.account_status !== "approved" ? " They weren't emailed because their account isn't approved yet." : emailed ? " They've been emailed." : " Email isn't set up yet, so they weren't emailed.") : ""
          }`,
  };
}
