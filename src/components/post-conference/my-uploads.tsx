"use client";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteMyPhoto } from "@/app/portal/gallery/actions";
import type { MyUpload } from "@/lib/post-conference/gallery";
import { Badge } from "@/components/ui/badge";
import { viewingAs } from "@/lib/view-as-client";

const STATUS: Record<MyUpload["status"], { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Waiting for review", tone: "warning" },
  accepted: { label: "In the gallery", tone: "success" },
  rejected: { label: "Not accepted", tone: "danger" },
};

/** The photos someone has added, where each one is up to, and a way to take any of them back. */
export function MyUploads({ items }: { items: MyUpload[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const list = items.filter((i) => !gone.includes(i.id));
  if (!list.length) return null;

  const remove = (id: string) => {
    if (viewingAs()) return setError("You're viewing as someone else, so changes are switched off.");
    setBusy(id);
    setError(null);
    start(async () => {
      const r = await deleteMyPhoto(id);
      setBusy(null);
      if (r.ok) setGone((g) => [...g, id]);
      else setError(r.error ?? "Something went wrong.");
    });
  };

  return (
    <section aria-labelledby="mine-h" className="app-card p-4 sm:p-6">
      <h2 id="mine-h" className="font-display text-xl text-ink">
        Your photos <span className="font-ui text-sm font-normal text-slate">({list.length})</span>
      </h2>
      <p className="mt-1 text-sm text-slate-700">Only you and the committee see photos that are waiting or weren&apos;t accepted.</p>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((i) => (
          <li key={i.id} className="overflow-hidden rounded-xl border border-navy/10 bg-white">
            <div className="relative aspect-[4/3] bg-paper-200">
              {i.url && <img src={i.url} alt={i.caption ?? "Your photo"} loading="lazy" className="size-full object-cover" />}
              <button
                type="button"
                onClick={() => remove(i.id)}
                disabled={busy === i.id}
                className="tap absolute right-1.5 top-1.5 grid size-10 place-items-center rounded-full bg-white/90 text-slate-700 shadow hover:text-danger disabled:opacity-60"
                aria-label={`Delete ${i.caption ? `"${i.caption}"` : "this photo"}`}
              >
                {busy === i.id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
              </button>
            </div>
            <div className="space-y-1 p-2.5">
              <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
              {i.caption && <p className="line-clamp-2 text-xs text-ink">{i.caption}</p>}
              {i.status === "rejected" && i.note && <p className="text-xs text-slate-700">Committee: {i.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
