import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  institution: string | null;
  programme: string | null;
  yearOfStudy: string | null;
  role: UserRole;
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
  const profile: Profile = {
    id: user.id,
    email: user.email ?? p?.email ?? "",
    fullName: p?.full_name ?? null,
    institution: p?.institution ?? null,
    programme: p?.programme ?? null,
    yearOfStudy: p?.year_of_study ?? null,
    role: (p?.role as UserRole) ?? "delegate",
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
 * allowed. Row level security enforces the same rules in the database.
 */
export async function requireRole(roles: UserRole[], next = "/admin") {
  const current = await requireUser(next);
  if (current.profile.role !== "admin" && !roles.includes(current.profile.role)) redirect("/portal?denied=1");
  return current;
}

export function hasRole(role: UserRole, min: UserRole) {
  return RANK[role] >= RANK[min];
}
