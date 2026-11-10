import { CAPABILITIES, type Capability } from "./index";
import type { AccountStatus, AccountType, UserRole } from "@/lib/types";

export type OverrideMode = "inherit" | "allow" | "block";

/**
 * Works out what someone can do from the account type rules and their own
 * overrides. Mirrors public.has_access() so the platform dashboard can show
 * the result before the database is asked.
 */
export function effectiveFor(
  person: { role: UserRole; accountType: AccountType; accountStatus: AccountStatus },
  rules: Partial<Record<AccountType, Partial<Record<Capability, boolean>>>>,
  overrides: Partial<Record<Capability, boolean>>,
): Record<Capability, { allowed: boolean; source: "owner" | "override" | "type" | "status" | "legacy" }> {
  const out = {} as Record<Capability, { allowed: boolean; source: "owner" | "override" | "type" | "status" | "legacy" }>;
  for (const c of CAPABILITIES) {
    const legacy = person.role === "editor" && (c === "edit_website" || c === "review_submissions");
    if (person.role === "admin") out[c] = { allowed: true, source: "owner" };
    else if (overrides[c] !== undefined) out[c] = { allowed: Boolean(overrides[c]) && person.accountStatus !== "declined", source: "override" };
    else if (person.accountStatus !== "approved") out[c] = { allowed: legacy, source: legacy ? "legacy" : "status" };
    else out[c] = { allowed: Boolean(rules[person.accountType]?.[c]) || legacy, source: legacy && !rules[person.accountType]?.[c] ? "legacy" : "type" };
  }
  return out;
}
