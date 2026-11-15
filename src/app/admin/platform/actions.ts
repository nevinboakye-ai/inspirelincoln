"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccess } from "@/lib/auth";
import { SWITCHES } from "@/lib/switches";
import { ACCOUNT_TYPES, CAPABILITIES, DEFAULT_RULES, type Capability } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export type PlatformResult = { ok: boolean; error?: string; message?: string };

const capability = z.enum(CAPABILITIES as unknown as [Capability, ...Capability[]]);
const accountType = z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]]);

const NOT_READY = "The access settings aren't set up in the database yet. Run the access control migration first.";
/** A newer area isn't in the database yet (the foreign key to access_capabilities fails). */
const NEEDS_AREAS = "That area isn't in the database yet. Run setup file 41 (access areas) in Supabase, then try again.";

/** Turns one permission on or off for everyone with an account type. Site owner, or anyone with the Platform dashboard permission. */
export async function setRule(input: { accountType: AccountType; capability: Capability; allowed: boolean }): Promise<PlatformResult> {
  const { db } = await requireAccess("manage_platform", "/admin/platform");
  const v = z.object({ accountType, capability, allowed: z.boolean() }).safeParse(input);
  if (!v.success) return { ok: false, error: "That change isn't valid." };
  const { error } = await db
    .from("access_rules")
    .upsert({ account_type: v.data.accountType, capability: v.data.capability, allowed: v.data.allowed }, { onConflict: "account_type,capability" });
  if (error) return { ok: false, error: error.code === "42P01" ? NOT_READY : error.code === "23503" ? NEEDS_AREAS : "Could not save that change." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Puts every account type back to how the site started. Site owner, or anyone with the Platform dashboard permission. */
export async function resetRules(): Promise<PlatformResult> {
  const { db } = await requireAccess("manage_platform", "/admin/platform");
  const rows = ACCOUNT_TYPES.flatMap((t) => CAPABILITIES.map((c) => ({ account_type: t, capability: c, allowed: DEFAULT_RULES[t].includes(c) })));
  const { error } = await db.from("access_rules").upsert(rows, { onConflict: "account_type,capability" });
  if (error) return { ok: false, error: error.code === "42P01" ? NOT_READY : error.code === "23503" ? NEEDS_AREAS : "Could not reset the permissions." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Permissions are back to the defaults." };
}

/** Gives or removes one permission for one person, or goes back to their account type's default. Site owner, or anyone with the Platform dashboard permission. */
export async function setOverride(input: { userId: string; capability: Capability; mode: "inherit" | "allow" | "block" }): Promise<PlatformResult> {
  const { db, user } = await requireAccess("manage_platform", "/admin/platform");
  const v = z.object({ userId: z.string().uuid(), capability, mode: z.enum(["inherit", "allow", "block"]) }).safeParse(input);
  if (!v.success) return { ok: false, error: "That change isn't valid." };
  if (v.data.userId === user.id) return { ok: false, error: "You can't change your own access." };
  const { data: target } = await db.from("profiles").select("role").eq("id", v.data.userId).maybeSingle();
  if (!target) return { ok: false, error: "That account no longer exists." };
  if (target.role === "admin") return { ok: false, error: "Site owners always have every permission." };
  const q =
    v.data.mode === "inherit"
      ? db.from("access_overrides").delete().eq("user_id", v.data.userId).eq("capability", v.data.capability)
      : db
          .from("access_overrides")
          .upsert({ user_id: v.data.userId, capability: v.data.capability, allowed: v.data.mode === "allow" }, { onConflict: "user_id,capability" });
  const { error } = await q;
  if (error) return { ok: false, error: error.code === "42P01" ? NOT_READY : error.code === "23503" ? NEEDS_AREAS : "Could not save that change." };
  revalidatePath("/admin/platform", "layout");
  return { ok: true };
}

/** Sets several permissions for one person at once, e.g. every website area. Site owner, or anyone with the Platform dashboard permission. */
export async function setOverrides(input: { userId: string; capabilities: Capability[]; mode: "inherit" | "allow" | "block" }): Promise<PlatformResult> {
  const { db, user } = await requireAccess("manage_platform", "/admin/platform");
  const v = z.object({ userId: z.string().uuid(), capabilities: z.array(capability).min(1).max(CAPABILITIES.length), mode: z.enum(["inherit", "allow", "block"]) }).safeParse(input);
  if (!v.success) return { ok: false, error: "That change isn't valid." };
  if (v.data.userId === user.id) return { ok: false, error: "You can't change your own access." };
  const { data: target } = await db.from("profiles").select("role").eq("id", v.data.userId).maybeSingle();
  if (!target) return { ok: false, error: "That account no longer exists." };
  if (target.role === "admin") return { ok: false, error: "Site owners always have every permission." };
  const { error } =
    v.data.mode === "inherit"
      ? await db.from("access_overrides").delete().eq("user_id", v.data.userId).in("capability", v.data.capabilities)
      : await db
          .from("access_overrides")
          .upsert(v.data.capabilities.map((c) => ({ user_id: v.data.userId, capability: c, allowed: v.data.mode === "allow" })), { onConflict: "user_id,capability" });
  if (error) return { ok: false, error: error.code === "42P01" ? NOT_READY : error.code === "23503" ? NEEDS_AREAS : "Could not save those changes." };
  revalidatePath("/admin/platform", "layout");
  return { ok: true };
}

/** Turns one permission on or off for several account types at once. Site owner, or anyone with the Platform dashboard permission. */
export async function setRules(input: { accountTypes: AccountType[]; capabilities: Capability[]; allowed: boolean }): Promise<PlatformResult> {
  const { db } = await requireAccess("manage_platform", "/admin/platform");
  const v = z.object({ accountTypes: z.array(accountType).min(1), capabilities: z.array(capability).min(1), allowed: z.boolean() }).safeParse(input);
  if (!v.success) return { ok: false, error: "That change isn't valid." };
  const rows = v.data.accountTypes.flatMap((t) => v.data.capabilities.map((c) => ({ account_type: t, capability: c, allowed: v.data.allowed })));
  const { error } = await db.from("access_rules").upsert(rows, { onConflict: "account_type,capability" });
  if (error) return { ok: false, error: error.code === "42P01" ? NOT_READY : error.code === "23503" ? NEEDS_AREAS : "Could not save those changes." };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Turns one of the site switches on or off. Site owner, or anyone with the Platform dashboard permission. */
export async function setSwitch(form: FormData) {
  const { db, user } = await requireAccess("manage_platform", "/admin/platform");
  const key = String(form.get("key"));
  if (!(key in SWITCHES)) return;
  await db.from("site_switches").upsert({ key, enabled: form.get("enabled") === "on", updated_by: user.id, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}
