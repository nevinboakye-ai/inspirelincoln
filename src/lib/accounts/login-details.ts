import "server-only";
import { randomInt } from "node:crypto";
import { serviceClient } from "@/lib/view-as";
import type { AccountType } from "@/lib/types";

/** No 0/O, 1/l/I, so it can be typed from an email without mistakes. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Three groups of four, e.g. "k7Qm-xP4r-T9wd": about 70 bits, well over the 10 character minimum. */
export function temporaryPassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

export type LoginDetails =
  /** A new account, or one whose owner hasn't chosen a password yet: a fresh temporary password. */
  | { kind: "temporary"; email: string; password: string }
  /** They have chosen their own password, so it's left alone. */
  | { kind: "existing"; email: string };

export const loginDetailsAvailable = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Makes sure each person can log in, and returns what to tell them.
 * - On the selected list with no account yet: creates their account (approved,
 *   from the list) with a temporary password.
 * - Account still on a temporary password: issues a new one, since the old one
 *   can't be read back.
 * - Account with their own password: nothing changes.
 * Anyone given a temporary password must change it when they first log in.
 */
export async function prepareLogins(people: { email: string; joined: boolean; account_type?: AccountType }[]): Promise<Map<string, LoginDetails> | null> {
  const admin = serviceClient();
  if (!admin) return null;
  const out = new Map<string, LoginDetails>();

  // Find existing accounts by email (the profile id is the auth user id).
  const emails = people.map((p) => p.email.toLowerCase());
  const ids = new Map<string, string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await admin.from("profiles").select("id, email").in("email", emails.slice(i, i + 200));
    for (const r of data ?? []) ids.set(String(r.email).toLowerCase(), r.id);
  }

  for (const p of people) {
    const email = p.email.toLowerCase();
    const id = ids.get(email);
    if (!id) {
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { must_change_password: true },
        user_metadata: { account_type: p.account_type ?? "delegate", created_by_committee: true },
      });
      if (!error) out.set(email, { kind: "temporary", email, password });
      else if (/already/i.test(error.message)) out.set(email, { kind: "existing", email });
      else console.error("Could not create account for a selected delegate:", error.status, error.code);
      continue;
    }
    const { data } = await admin.auth.admin.getUserById(id);
    const meta = data.user?.app_metadata ?? {};
    if (meta.must_change_password === true) {
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(id, { password, app_metadata: { ...meta, must_change_password: true } });
      out.set(email, error ? { kind: "existing", email } : { kind: "temporary", email, password });
    } else {
      out.set(email, { kind: "existing", email });
    }
  }
  return out;
}

/** Clears the "change your password" flag once they've chosen their own. */
export async function clearTemporaryPassword(userId: string) {
  const admin = serviceClient();
  if (!admin) return;
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = data.user?.app_metadata ?? {};
  if (meta.must_change_password) await admin.auth.admin.updateUserById(userId, { app_metadata: { ...meta, must_change_password: false } });
}
