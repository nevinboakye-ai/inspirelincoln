"use client";
import { Bookmark, BookmarkCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

/** Saves an opportunity to the signed-in user's account (RLS: own rows only). */
export function SaveOpportunity({ id, title }: { id: string; title: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return setUid(null);
    db.auth.getUser().then(async ({ data }: { data: { user: { id: string } | null } }) => {
      const u = data.user?.id ?? null;
      setUid(u);
      if (u) {
        const { data: row } = await db.from("saved_opportunities").select("opportunity_id").eq("opportunity_id", id).maybeSingle();
        setSaved(Boolean(row));
      }
    });
  }, [id]);

  if (uid === undefined) return null;
  if (!uid) {
    return (
      <Link href="/login" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-medium text-ink hover:border-navy/40">
        <Bookmark aria-hidden className="size-4" /> Sign in to save
      </Link>
    );
  }
  const toggle = async () => {
    const db = getBrowserClient()!;
    const next = !saved;
    setSaved(next);
    const res = next ? await db.from("saved_opportunities").insert({ user_id: uid, opportunity_id: id }) : await db.from("saved_opportunities").delete().eq("opportunity_id", id).eq("user_id", uid);
    if (res.error) {
      setSaved(!next);
      toast({ tone: "error", title: "Couldn't update saved opportunities" });
    } else toast({ tone: "success", title: next ? "Opportunity saved" : "Removed from saved", body: title });
  };
  return (
    <button type="button" aria-pressed={saved} onClick={toggle} className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-medium text-ink hover:border-navy/40">
      {saved ? <BookmarkCheck aria-hidden className="size-4 text-electric-600" /> : <Bookmark aria-hidden className="size-4" />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
