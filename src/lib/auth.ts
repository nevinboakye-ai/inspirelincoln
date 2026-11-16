import "server-only";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, createSessionClient, getViewAs } from "@/lib/supabase/server";
import type { AccountStatus, AccountType, UserRole } from "@/lib/types";
import { accessFor, accessFromCaps, effectiveRole, type Access, type Capability } from "@/lib/accounts";

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  institution: string | null;
  programme: string | null;
  yearOfStudy: string | null;
  careerStage: string | null;
  committeePosition: string | null;
  presentationTitle: string | null;
  accessibilityNeeds: string | null;
  dietaryRequirements: string | null;
  photoOptOut: boolean;
  marketingOptIn: boolean;
  accountType: AccountType;
  /** Roles held as well as the main one, for example a committee member who is also presenting. */
  extraTypes: AccountType[];
  accountStatus: AccountStatus;
  reviewNote: string | null;
  bio: string | null;
  linkedinUrl: string | null;
  instagram: string | null;
  /** Show the account email on the delegate network. */
  networkShowEmail: boolean;
  /** They've answered whether to show their email to other delegates. */
  networkEmailAsked: boolean;
  /** Appear on the delegate network at all. */
  /** Private code in their Delegate Card QR (null until the card code migration is run). */
  cardCode: string | null;
  /** Whether people who scan their card see their details. */
  cardShared: boolean;
  /** Their profile photo in the private avatars folder, if they've added one. */
  avatarPath: string | null;
  /** The permission tier used by role gates, derived from the account type and status. */
  role: UserRole;
  /** The role stored on the profile, used only as a site admin override. */
  siteRole: UserRole;
  access: Access;
}

/** The signed-in person, as read from their verified access token. */
export type SessionUser = Pick<User, "id" | "email" | "app_metadata" | "user_metadata">;

/**
 * Who is signed in, from a verified access token. getClaims checks the token's
 * signature locally against the project's cached public keys, so pages don't
 * wait on a round trip to the auth server on every navigation (with the older
 * shared-secret keys it falls back to asking the auth server, as before).
 */
async function verifiedUser(db: NonNullable<Awaited<ReturnType<typeof createClient>>>): Promise<SessionUser | null> {
  const { data, error } = await db.auth.getClaims();
  const c = data?.claims;
  if (error || !c?.sub) return null;
  return {
    id: c.sub,
    email: (c.email as string | undefined) ?? undefined,
    app_metadata: (c.app_metadata ?? {}) as User["app_metadata"],
    user_metadata: (c.user_metadata ?? {}) as User["user_metadata"],
  };
}

/** The verified current user (from a verified access token, never the unverified session) and profile. */
export const getCurrentUser = cache(async () => {
  const db = await createClient();
  if (!db) return null;
  const user = await verifiedUser(db);
  if (!user) return null;
  const [{ data: p }, caps] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.rpc("my_access"),
  ]);
  // No profile row: make sure the account still exists (a removed account's
  // token stays valid until it expires) before carrying on with the defaults.
  if (!p) {
    const { data: live } = await db.auth.getUser();
    if (!live.user) return null;
  }
  const base = {
    role: ((p?.role as UserRole) ?? "delegate") as UserRole,
    accountType: ((p?.account_type as AccountType) ?? "delegate") as AccountType,
    accountStatus: ((p?.account_status as AccountStatus) ?? "pending") as AccountStatus,
  };
  // The database decides access (public.my_access). Fall back to the defaults
  // only if the access control migration hasn't been run yet.
  const access = caps.error || !Array.isArray(caps.data) ? accessFor(base) : accessFromCaps(caps.data as string[], base.role);
  const profile: Profile = {
    id: user.id,
    email: user.email ?? p?.email ?? "",
    fullName: p?.full_name ?? null,
    institution: p?.institution ?? null,
    programme: p?.programme ?? null,
    yearOfStudy: p?.year_of_study ?? null,
    careerStage: p?.career_stage ?? null,
    committeePosition: p?.committee_position ?? null,
    presentationTitle: p?.presentation_title ?? null,
    accessibilityNeeds: p?.accessibility_needs ?? null,
    dietaryRequirements: p?.dietary_requirements ?? null,
    photoOptOut: Boolean(p?.photo_opt_out),
    marketingOptIn: Boolean(p?.marketing_opt_in),
    accountType: base.accountType,
    extraTypes: (((p?.extra_types as AccountType[] | null) ?? []) as AccountType[]).filter((t) => t !== base.accountType),
    accountStatus: base.accountStatus,
    reviewNote: p?.review_note ?? null,
    bio: p?.bio ?? null,
    linkedinUrl: p?.linkedin_url ?? null,
    instagram: p?.instagram ?? null,
    networkShowEmail: Boolean(p?.network_show_email),
    // Before setup SQL 28 the column is missing: treat sharers as asked, so nobody is asked twice once it runs.
    networkEmailAsked: Boolean(p?.network_email_asked ?? p?.network_show_email),
    cardCode: p?.card_code ?? null,
    cardShared: p?.card_shared ?? true,
    avatarPath: p?.avatar_path ?? null,
    role: effectiveRole(access, base.role),
    siteRole: base.role,
    access,
  };
  // Note when they were last active (the database only writes every five
  // minutes). Never while the site owner is viewing as someone else.
  after(async () => {
    try {
      if (await getViewAs()) return;
      await (await createSessionClient())?.rpc("touch_last_seen");
    } catch {}
  });
  return { user, profile, db };
});

export async function requireUser(next = "/portal") {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(next)}`);
  return current;
}

const RANK: Record<UserRole, number> = { delegate: 0, reviewer: 1, editor: 2, admin: 3 };

/**
 * Older role gate, kept for the content and records pages. "admin" means
 * delegate records (manage_people), "editor" means editing the website and
 * "reviewer" means abstract reviewing. The site owner passes every gate.
 * Row level security enforces the same rules in the database.
 */
export async function requireRole(roles: UserRole[], next = "/admin") {
  const current = await requireUser(next);
  const { access, siteRole } = current.profile;
  const ok =
    access.owner ||
    (roles.includes("admin") && access.can.manage_people) ||
    (roles.includes("editor") && access.editor) ||
    (roles.includes("reviewer") && (siteRole === "reviewer" || access.can.review_submissions));
  if (!ok) redirect("/portal?denied=1");
  return current;
}

/**
 * Permission gate. Pass one permission, several (any of them is enough),
 * "any" for anyone with a dashboard permission, or "owner".
 */
export async function requireAccess(need: Capability | Capability[] | "any" | "owner", next = "/admin") {
  const current = await requireUser(next);
  const { access } = current.profile;
  const ok =
    access.owner ||
    (need === "any" ? access.committee : need === "owner" ? false : (Array.isArray(need) ? need : [need]).some((c) => access.can[c]));
  if (!ok) redirect(need === "any" ? "/portal?denied=1" : "/admin?denied=1");
  return current;
}

export function hasRole(role: UserRole, min: UserRole) {
  return RANK[role] >= RANK[min];
}
