import "server-only";
import { createClient } from "@/lib/supabase/server";

export const SWITCHES = {
  site_open: { label: "Public website", on: "Open to everyone", off: "Closed: visitors only see log in and account set-up, delegates only see My Hub. Committee members still see everything." },
  network_open: { label: "Delegate network", on: "Open to confirmed delegates", off: "Hidden from everyone but you" },
  delegate_card: { label: "Delegate Card", on: "Shown in My Hub", off: "Hidden from delegates" },
  map_open: { label: "Campus map", on: "Open", off: "Coming soon. Committee members can still preview it" },
} as const;
export type SwitchKey = keyof typeof SWITCHES;

/** The owner's switches. Anything missing (migration not run yet) counts as open, so nobody is locked out by accident. */
export async function getSwitches(): Promise<Record<SwitchKey, boolean>> {
  const db = await createClient();
  const out = { site_open: true, network_open: false, delegate_card: true, map_open: true } as Record<SwitchKey, boolean>;
  if (!db) return out;
  const { data, error } = await db.from("site_switches").select("key, enabled");
  if (error || !data) return out;
  for (const r of data) if (r.key in out) out[r.key as SwitchKey] = r.enabled;
  return out;
}
