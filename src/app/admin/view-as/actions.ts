"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env";
import { VIEW_AS_COOKIE, VIEW_AS_WHO_COOKIE, sealViewAs } from "@/lib/view-as-seal";
import { endViewAs, logViewAs, plainClient, serviceClient } from "@/lib/view-as";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

const safeBack = (v: FormDataEntryValue | null, fallback: string) => {
  const s = typeof v === "string" ? v : "";
  return /^\/[a-z0-9/_-]*$/i.test(s) ? s : fallback;
};

/**
 * Site owner only. Opens a real, read-only session for another account, so
 * every page shows exactly what they see. It ends after an hour at most, or
 * when the owner presses Stop. Each start and stop is written to the audit log.
 */
export async function startViewAs(form: FormData) {
  const id = String(form.get("id") ?? "");
  const back = safeBack(form.get("back"), `/admin/accounts/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect(back);

  const real = await createSessionClient();
  const { data: { user } = { user: null } } = (await real?.auth.getUser()) ?? {};
  if (!real || !user) redirect("/login?next=/admin/platform");
  const { data: me } = await real.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "admin") redirect("/portal?denied=1");

  const admin = serviceClient();
  if (!admin) redirect(`${back}?viewas=nokey`);
  const { data: target } = await admin.from("profiles").select("id, email, full_name, role, account_type").eq("id", id).maybeSingle();
  if (!target) redirect(`${back}?viewas=missing`);
  if (target.role === "admin" || target.id === user.id) redirect(`${back}?viewas=owner`);

  // Finish any earlier view first, so its session doesn't linger.
  await endViewAs();

  // Starting the session below counts as a sign-in to the auth service, so
  // note their own last sign-in first and put it back afterwards.
  const { data: before } = await admin.auth.admin.getUserById(target.id);
  const ownSignIn = before?.user?.last_sign_in_at ?? null;

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email });
  const hashed = link?.properties?.hashed_token;
  if (linkError || !hashed) redirect(`${back}?viewas=failed`);
  const { data: verified, error } = await plainClient(SUPABASE_ANON_KEY).auth.verifyOtp({ type: "magiclink", token_hash: hashed });
  const session = verified?.session;
  if (error || !session || session.user.id !== target.id) redirect(`${back}?viewas=failed`);
  const { error: keepError } = await admin.rpc("keep_last_sign_in", { p_user: target.id, p_at: ownSignIn });
  if (keepError) console.error("view as: could not keep last sign-in", keepError.message);

  const expires = session.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
  const maxAge = Math.max(60, expires - Math.floor(Date.now() / 1000) - 30);
  const name = target.full_name || target.email;
  const label = `${name} · ${ACCOUNT_TYPE_LABEL[target.account_type as AccountType] ?? "Account"}`;
  const store = await cookies();
  const base = { path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge };
  store.set(VIEW_AS_COOKIE, sealViewAs({ o: user.id, t: target.id, a: session.access_token, r: session.refresh_token, e: expires, n: name }), { ...base, httpOnly: true });
  store.set(VIEW_AS_WHO_COOKIE, encodeURIComponent(JSON.stringify({ label, until: expires, id: target.id })), { ...base, httpOnly: false });
  await logViewAs("view_as_start", user.id, target.id, name);
  redirect("/portal");
}
