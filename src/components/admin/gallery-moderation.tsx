"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check, CheckCheck, Flag, Loader2, RotateCcw, Trash2, X, ZoomIn } from "lucide-react";
import { deletePhotos, reviewPhotos } from "@/app/admin/gallery/actions";
import { btn } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

export type QueuePhoto = {
  id: string;
  url: string | null;
  caption: string | null;
  uploader: string;
  createdAt: string;
  reviewNote: string | null;
  reviewer: string | null;
  reviewedAt: string | null;
  reportNote: string | null;
};

export type QueueView = "pending" | "reported" | "accepted" | "rejected";

/** Quick reasons for not accepting a photo. The uploader sees the one chosen. */
const REASONS = ["Blurry or too dark", "Not from INSPIRE", "Someone in it asked not to be shown", "Not suitable to share", "A duplicate"];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "");

/**
 * The committee's photo queue. Accept or reject each photo with one tap, or
 * tick several and do them together. Rejecting asks for a quick reason the
 * uploader will see. Accepted photos can be taken down again, and any photo
 * can be deleted for good.
 */
export function GalleryModeration({ view, photos }: { view: QueueView; photos: QueuePhoto[] }) {
  const router = useRouter();
  const [done, setDone] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [zoom, setZoom] = useState<QueuePhoto | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const list = photos.filter((p) => !done.includes(p.id));
  const allPicked = list.length > 0 && list.every((p) => picked.includes(p.id));

  const act = (key: string, ids: string[], run: () => Promise<{ ok: boolean; error?: string; count?: number }>, said: (n: number) => string) => {
    if (viewingAs()) return setMsg({ ok: false, text: "You're viewing as someone else, so changes are switched off." });
    setBusy(key);
    setMsg(null);
    start(async () => {
      const r = await run();
      setBusy(null);
      if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Something went wrong." });
      setDone((d) => [...d, ...ids]);
      setPicked((p) => p.filter((x) => !ids.includes(x)));
      setMsg({ ok: true, text: said(r.count ?? ids.length) });
      router.refresh();
    });
  };
  const n = (k: number) => `${k} photo${k === 1 ? "" : "s"}`;
  const accept = (ids: string[]) => act(`accept:${ids.join()}`, ids, () => reviewPhotos({ ids, status: "accepted" }), (k) => `${n(k)} accepted and in the gallery.`);
  const restore = (ids: string[]) => act(`restore:${ids.join()}`, ids, () => reviewPhotos({ ids, status: "accepted" }), (k) => `${n(k)} back in the gallery.`);
  const takeDown = (ids: string[]) => act(`down:${ids.join()}`, ids, () => reviewPhotos({ ids, status: "pending" }), (k) => `${n(k)} taken down and back in the queue.`);
  const remove = (ids: string[]) => act(`delete:${ids.join()}`, ids, () => deletePhotos(ids), (k) => `${n(k)} deleted for good.`);

  if (!list.length) {
    return (
      <div className="app-card grid place-items-center p-10 text-center">
        <CheckCheck aria-hidden className="size-9 text-success" />
        <p className="mt-3 font-display text-xl text-ink">{view === "pending" ? "All caught up" : view === "reported" ? "Nothing reported" : "Nothing here"}</p>
        <p className="mt-1 text-sm text-slate-700">{view === "pending" ? "There are no photos waiting. New ones will appear here." : "Photos will show here as they're reviewed."}</p>
        {msg?.ok && (
          <p role="status" className="mt-3 text-sm font-medium text-success">
            {msg.text}
          </p>
        )}
      </div>
    );
  }

  const queueView = view === "pending" || view === "reported";

  return (
    <div className="space-y-4">
      <div className="sticky top-[calc(var(--header-h)+4.5rem)] z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-white/90 p-2.5 shadow-[var(--shadow-soft)] ring-1 ring-navy/[0.08] backdrop-blur lg:top-24">
        <label className="tap inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-paper-200">
          <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? [] : list.map((p) => p.id))} className="size-5 accent-[var(--color-navy)]" />
          {picked.length ? `${picked.length} chosen` : "Choose all"}
        </label>
        {picked.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2">
            {queueView && (
              <>
                <button type="button" onClick={() => accept(picked)} disabled={Boolean(busy)} className={btn.primary}>
                  <Check aria-hidden className="size-4" /> Accept {picked.length}
                </button>
                <button type="button" onClick={() => setRejecting(picked)} disabled={Boolean(busy)} className={btn.danger}>
                  <X aria-hidden className="size-4" /> Reject {picked.length}
                </button>
              </>
            )}
            {view === "accepted" && (
              <button type="button" onClick={() => takeDown(picked)} disabled={Boolean(busy)} className={btn.secondary}>
                <RotateCcw aria-hidden className="size-4" /> Take down {picked.length}
              </button>
            )}
            {view === "rejected" && (
              <>
                <button type="button" onClick={() => restore(picked)} disabled={Boolean(busy)} className={btn.secondary}>
                  <Check aria-hidden className="size-4" /> Accept {picked.length}
                </button>
                <button type="button" onClick={() => remove(picked)} disabled={Boolean(busy)} className={btn.danger}>
                  <Trash2 aria-hidden className="size-4" /> Delete {picked.length}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl p-3 text-sm font-medium", msg.ok ? "border border-success/25 bg-success/[0.06] text-success" : "border border-danger/25 bg-danger/[0.06] text-danger")}>
          {msg.text}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => {
          const on = picked.includes(p.id);
          return (
            <li key={p.id} className={cn("overflow-hidden rounded-2xl border bg-white transition-shadow", on ? "border-navy shadow-[0_0_0_2px_var(--color-navy)]" : "border-navy/10")}>
              <div className="relative aspect-[4/3] bg-midnight">
                {p.url && <img src={p.url} alt={p.caption ?? `Photo from ${p.uploader}`} loading="lazy" className="size-full object-contain" />}
                <label className="absolute left-2 top-2 grid size-11 cursor-pointer place-items-center rounded-full bg-white/90 shadow">
                  <span className="sr-only">Choose this photo</span>
                  <input type="checkbox" checked={on} onChange={() => setPicked((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]))} className="size-5 accent-[var(--color-navy)]" />
                </label>
                {p.url && (
                  <button type="button" onClick={() => setZoom(p)} className="tap absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-white/90 text-ink shadow" aria-label="See it bigger">
                    <ZoomIn aria-hidden className="size-4" />
                  </button>
                )}
              </div>
              <div className="space-y-2 p-3">
                {p.reportNote && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-coral-100 p-2 text-xs font-medium text-ink">
                    <Flag aria-hidden className="mt-px size-3.5 shrink-0 text-coral" /> Reported: {p.reportNote}
                  </p>
                )}
                {p.caption && <p className="line-clamp-2 text-sm font-semibold text-ink">{p.caption}</p>}
                <p className="text-xs text-slate-700">
                  {p.uploader} · {when(p.createdAt)}
                </p>
                {!queueView && p.reviewer && (
                  <p className="text-xs text-slate">
                    {view === "accepted" ? "Accepted" : "Rejected"} by {p.reviewer}
                    {p.reviewedAt ? `, ${when(p.reviewedAt)}` : ""}
                    {p.reviewNote ? `: ${p.reviewNote}` : ""}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  {queueView ? (
                    <>
                      <button type="button" onClick={() => accept([p.id])} disabled={Boolean(busy)} className={cn(btn.primary, "flex-1 px-3")}>
                        {busy === `accept:${p.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />} Accept
                      </button>
                      <button type="button" onClick={() => setRejecting([p.id])} disabled={Boolean(busy)} className={cn(btn.danger, "flex-1 px-3")}>
                        <X aria-hidden className="size-4" /> Reject
                      </button>
                    </>
                  ) : view === "accepted" ? (
                    <button type="button" onClick={() => takeDown([p.id])} disabled={Boolean(busy)} className={cn(btn.secondary, "flex-1 px-3")}>
                      {busy === `down:${p.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />} Take down
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => restore([p.id])} disabled={Boolean(busy)} className={cn(btn.secondary, "flex-1 px-3")}>
                        <Check aria-hidden className="size-4" /> Accept
                      </button>
                      <button type="button" onClick={() => remove([p.id])} disabled={Boolean(busy)} className={cn(btn.danger, "flex-1 px-3")} aria-label="Delete for good">
                        <Trash2 aria-hidden className="size-4" /> Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {rejecting && (
        <RejectDialog
          count={rejecting.length}
          onClose={() => setRejecting(null)}
          onReject={(note) => {
            const ids = rejecting;
            setRejecting(null);
            act(`reject:${ids.join()}`, ids, () => reviewPhotos({ ids, status: "rejected", note }), (k) => `${n(k)} rejected. The uploader can see why.`);
          }}
        />
      )}
      {zoom?.url && <ZoomDialog photo={zoom} onClose={() => setZoom(null)} />}
    </div>
  );
}

function RejectDialog({ count, onClose, onReject }: { count: number; onClose: () => void; onReject: (note: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [other, setOther] = useState("");
  const titleId = useId();
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink shadow-[0_40px_90px_-30px_rgba(12,24,44,0.7)] backdrop:bg-midnight/60 open:animate-[enter-pop_0.35s_var(--ease-out-expo)] motion-reduce:open:animate-none"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          onReject(reason === "other" ? other.trim() : reason);
          dialog.current?.close();
        }}
        className="space-y-4 p-5"
      >
        <h2 id={titleId} className="font-display text-xl">
          Reject {count === 1 ? "this photo" : `${count} photos`}?
        </h2>
        <p className="text-sm text-slate-700">The person who added {count === 1 ? "it" : "them"} sees the reason. Nobody else does.</p>
        <fieldset className="grid gap-2">
          <legend className="sr-only">Reason</legend>
          {[...REASONS, "other"].map((r) => (
            <label key={r} className={cn("tap flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2 text-sm font-medium", reason === r ? "border-navy bg-paper-200 text-ink" : "border-navy/10 text-slate-700")}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-navy)]" />
              {r === "other" ? "Another reason" : r}
            </label>
          ))}
        </fieldset>
        {reason === "other" && <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={300} placeholder="Write a short reason" aria-label="Reason" className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm" autoFocus />}
        <div className="flex gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className={cn(btn.secondary, "flex-1")}>
            Cancel
          </button>
          <button type="submit" className={cn(btn.danger, "flex-1")}>
            <X aria-hidden className="size-4" /> Reject
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ZoomDialog({ photo, onClose }: { photo: QueuePhoto; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={dialog} onClose={onClose} aria-label={photo.caption ?? "Photo"} className="m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-midnight p-0 backdrop:bg-midnight/80" onClick={() => dialog.current?.close()}>
      <img src={photo.url!} alt={photo.caption ?? `Photo from ${photo.uploader}`} className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] object-contain" />
      <button type="button" onClick={() => dialog.current?.close()} className="tap absolute right-3 top-3 grid size-11 place-items-center rounded-full bg-white/90 text-ink" aria-label="Close">
        <X aria-hidden className="size-5" />
      </button>
    </dialog>
  );
}
