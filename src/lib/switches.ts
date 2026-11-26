import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const SWITCHES = {
  site_open: { label: "Public website", on: "Open to everyone", off: "Closed: visitors only see log in and account set-up, delegates only see My Hub. Committee members still see everything." },
  network_open: { label: "Delegate network", on: "Open to confirmed delegates", off: "Hidden from everyone but you" },
  delegate_card: { label: "Delegate Card", on: "Shown in My Hub", off: "Hidden from delegates" },
  map_open: { label: "Campus map", on: "Open", off: "Coming soon. Committee members can still preview it" },
  delegate_messages: { label: "Delegate messages", on: "Confirmed delegates can message each other (while the network is open)", off: "Only the committee can start conversations. Delegates can still reply" },
  whatsapp_group: { label: "WhatsApp group", on: "QR code and join link shown in My Hub", off: "Hidden from delegates. You can still preview it in My Hub" },
  post_conference: { label: "Post-conference hub", on: "Everyone with a confirmed place gives quick feedback on their next visit, which unlocks the post-conference hub and gallery", off: "Hidden from delegates. You can still preview it from My Hub" },
  oral_presenters_public: { label: "Oral presenters on the website", on: "Accepted oral presenters are shown with their photo, bio and talk title in their own section of the Speakers page (each can hide themselves in My Hub)", off: "Hidden from the public website" },
  presenting_public: { label: "Who's presenting", on: "Shown on cards and the delegate network", off: "Hidden: presenters show as delegates to everyone but themselves and the committee" },
} as const;
export type SwitchKey = keyof typeof SWITCHES;

/** The owner's switches. Anything missing (migration not run yet) counts as open, so nobody is locked out by accident. */
export const getSwitches = cache(async (): Promise<Record<SwitchKey, boolean>> => {
  const db = await createClient();
  const out = { site_open: true, network_open: false, delegate_card: true, map_open: true, presenting_public: false, delegate_messages: true, whatsapp_group: false, post_conference: false, oral_presenters_public: false } as Record<SwitchKey, boolean>;
  if (!db) return out;
  const { data, error } = await db.from("site_switches").select("key, enabled");
  if (error || !data) return out;
  for (const r of data) if (r.key in out) out[r.key as SwitchKey] = r.enabled;
  return out;
});
