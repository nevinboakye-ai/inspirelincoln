import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AccountStatus, AccountType, UserRole } from "@/lib/types";
import { accessFor, effectiveRole, type Access } from "@/lib/accounts";

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
  accountStatus: AccountStatus;
  reviewNote: string | null;
  /** The permission tier used by role gates, derived from the account type and status. */
  role: UserRole;
  /** The role stored on the profile, used only as a site admin override. */
  siteRole: UserRole;
  access: Access;
}

/** The verified current user (via Supabase getUser, not the unverified session) and profile. */
export const getCurrentUser = cache(async () => {
  const db = await createClient();
  if (!db) return null;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: p } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const base = {
    role: ((p?.role as UserRole) ?? "delegate") as UserRole,
    accountType: ((p?.account_type as AccountType) ?? "delegate") as AccountType,
    accountStatus: ((p?.account_status as AccountStatus) ?? "pending") as AccountStatus,
  };
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
    accountStatus: base.accountStatus,
    reviewNote: p?.review_note ?? null,
    role: effectiveRole(base),
    siteRole: base.role,
    access: accessFor(base),
  };
  return { user, profile, db };
});

export async function requireUser(next = "/portal") {
  const current = await getCurrentUser();
  if (!current) redirect(`/login?next=${encodeURIComponent(next)}`);
  return current;
}

const RANK: Record<UserRole, number> = { delegate: 0, reviewer: 1, editor: 2, admin: 3 };

/**
 * Server-side role gate. `roles` lists the roles allowed; admins are always
 * allowed. Committee members count as editors and executive members as
 * admins. Row level security enforces the same rules in the database.
 */
export async function requireRole(roles: UserRole[], next = "/admin") {
  const current = await requireUser(next);
  if (current.profile.role !== "admin" && !roles.includes(current.profile.role)) redirect("/portal?denied=1");
  return current;
}

export function hasRole(role: UserRole, min: UserRole) {
  return RANK[role] >= RANK[min];
}
