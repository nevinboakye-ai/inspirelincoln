import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnquiryThread } from "@/lib/enquiries";

/** The latest message in each conversation, for the list previews. */
export async function previews(db: SupabaseClient, threads: EnquiryThread[]) {
  const out = new Map<string, { body: string; from_committee: boolean }>();
  if (!threads.length) return out;
  const { data } = await db
    .from("enquiry_messages")
    .select("thread_id, body, from_committee, created_at")
    .in("thread_id", threads.map((t) => t.id))
    .order("created_at", { ascending: false })
    .limit(Math.min(1000, threads.length * 20));
  for (const m of data ?? []) if (!out.has(m.thread_id)) out.set(m.thread_id, { body: m.body, from_committee: m.from_committee });
  return out;
}
