"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Expand, Flag, Images, Loader2, Pause, Play, Shrink, X } from "lucide-react";
import { reportPhoto } from "@/app/portal/gallery/actions";
import { swipeDirection, wrapIndex } from "@/lib/post-conference/photos";
import type { GalleryPhoto } from "@/lib/post-conference/gallery";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

const AUTOPLAY_MS = 5000;
const REASONS = ["I'm in this photo and would like it taken down", "It shouldn't be shared", "Something else"];

/**
 * The gallery as a slideshow. Move with the arrows, the arrow keys, a swipe
 * on a phone or the strip of thumbnails; play it through on its own; or go
 * full screen. Anyone can ask for a photo to be taken down, which hides it
 * until the committee looks at it again.
 */
export function GallerySlideshow({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [drag, setDrag] = useState(0);
  const [reporting, setReporting] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const titleId = useId();
  const count = photos.length;
  const at = wrapIndex(index, count);
  const photo = photos[at];

  const go = useCallback(
    (step: number, manual = true) => {
      if (!count) return;
      if (manual) setPlaying(false);
      setDir(step < 0 ? "prev" : "next");
      setIndex((i) => wrapIndex(i + step, count));
    },
    [count],
  );
  const jump = (to: number) => {
    setPlaying(false);
    setDir(to < at ? "prev" : "next");
    setIndex(to);
  };

  // Arrow keys anywhere on the page, except while typing or with a dialog open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || reporting) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable], dialog")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, reporting]);

  // Play: a new photo every few seconds, paused while the tab is hidden.
  useEffect(() => {
    if (!playing || count < 2) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") go(1, false);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [playing, count, go]);

  // Load the photos either side so moving is instant.
  useEffect(() => {
    for (const k of [1, -1, 2]) {
      const p = photos[wrapIndex(at + k, count)];
      if (p) new Image().src = p.url;
    }
  }, [at, count, photos]);

  // Keep the current thumbnail in view.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>(`[data-i="${at}"]`);
    const box = strip.current;
    if (el && box) box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [at]);

  // Full screen where the browser allows it (not iPhone Safari, which only does it for videos).
  const [canFull, setCanFull] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only feature check after hydration
    setCanFull(Boolean(document.fullscreenEnabled));
    const onChange = () => setFull(document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.().catch(() => {});
  };

  if (!count || !photo) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-midnight p-6 text-center text-paper/75 sm:aspect-[16/9]">
        <div>
          <Images aria-hidden className="mx-auto size-10 text-cyan" />
          <p className="mt-3 font-display text-xl text-paper">No photos yet</p>
          <p className="mt-1 max-w-sm text-sm">The committee is adding the official photos from the day. Add yours below and they&apos;ll appear here once they&apos;ve been checked.</p>
        </div>
      </div>
    );
  }

  return (
    <section aria-roledescription="carousel" aria-labelledby={titleId} className="space-y-3">
      <h2 id={titleId} className="sr-only">
        Photos from the day
      </h2>
      <div
        ref={stage}
        className={cn(
          "group relative isolate touch-pan-y select-none overflow-hidden bg-midnight",
          full ? "flex h-full w-full items-center justify-center" : "aspect-[4/3] rounded-2xl sm:aspect-[16/10] lg:max-h-[72vh] lg:w-full",
        )}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if ((e.target as HTMLElement).closest("button")) return;
          start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > Math.abs(e.clientY - s.y)) setDrag(dx);
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          setDrag(0);
          if (!s || s.id !== e.pointerId) return;
          const way = swipeDirection(e.clientX - s.x, e.clientY - s.y);
          if (way) go(way === -1 ? 1 : -1);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(0);
        }}
      >
        {/* A soft, blurred copy of the photo fills the space around it. */}
        <img key={`bg-${photo.id}`} src={photo.url} alt="" aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full scale-110 object-cover opacity-40 blur-2xl" />
        <div className="absolute inset-0 -z-10 bg-midnight/40" />

        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`Photo ${at + 1} of ${count}`}
          className="absolute inset-0 grid place-items-center"
          style={{ transform: drag ? `translate3d(${drag * 0.6}px,0,0)` : undefined, transition: drag ? "none" : "transform 0.3s var(--ease-out-expo)" }}
        >
          <img
            key={photo.id}
            src={photo.url}
            alt={photo.caption ? photo.caption : `Photo ${at + 1} from the conference, shared by ${photo.credit}`}
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            draggable={false}
            className={cn("max-h-full max-w-full object-contain", dir === "next" ? "gallery-next" : "gallery-prev")}
          />
        </div>

        {/* Top bar: where you are, play and full screen. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-midnight/70 to-transparent p-2.5 sm:p-3">
          <p className="rounded-full bg-midnight/60 px-3 py-1 font-ui text-xs font-semibold tabular-nums text-paper backdrop-blur" aria-hidden>
            {at + 1} / {count}
          </p>
          <div className="flex gap-1.5">
            {count > 1 && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-pressed={playing}
                className="tap grid size-11 place-items-center rounded-full bg-midnight/60 text-paper backdrop-blur hover:bg-midnight/80 focus-visible:outline-2 focus-visible:outline-gold"
                aria-label={playing ? "Pause the slideshow" : "Play the slideshow"}
              >
                {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
              </button>
            )}
            {canFull && (
              <button
                type="button"
                onClick={toggleFull}
                className="tap grid size-11 place-items-center rounded-full bg-midnight/60 text-paper backdrop-blur hover:bg-midnight/80 focus-visible:outline-2 focus-visible:outline-gold"
                aria-label={full ? "Leave full screen" : "Full screen"}
              >
                {full ? <Shrink aria-hidden className="size-5" /> : <Expand aria-hidden className="size-5" />}
              </button>
            )}
          </div>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="tap absolute left-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-gold sm:left-3 sm:size-14"
              aria-label="Previous photo"
            >
              <ChevronLeft aria-hidden className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="tap absolute right-2 top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-gold sm:right-3 sm:size-14"
              aria-label="Next photo"
            >
              <ChevronRight aria-hidden className="size-6" />
            </button>
          </>
        )}

        {/* Bottom: caption, who shared it, and asking for it to come down. */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-midnight/85 via-midnight/40 to-transparent px-3 pb-3 pt-10 text-paper sm:px-4 sm:pb-4">
          <div className="min-w-0">
            {photo.caption && <p className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">{photo.caption}</p>}
            <p className="truncate text-xs text-paper/75">{photo.mine ? "Shared by you" : `Shared by ${photo.credit}`}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setReporting(true);
            }}
            className="tap inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-midnight/60 px-3 text-xs font-semibold text-paper/90 backdrop-blur hover:bg-midnight/80 focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Flag aria-hidden className="size-3.5" /> <span className="hidden sm:inline">Ask to take down</span>
            <span className="sm:hidden">Report</span>
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {playing ? "" : `Photo ${at + 1} of ${count}${photo.caption ? `: ${photo.caption}` : ""}`}
      </p>

      {count > 1 && (
        <div ref={strip} className="no-scrollbar scroll-fade-x flex gap-1.5 overflow-x-auto scroll-smooth px-0.5 py-1" aria-label="Choose a photo" role="group">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              data-i={i}
              onClick={() => jump(i)}
              aria-label={`Photo ${i + 1}${p.caption ? `: ${p.caption}` : ""}`}
              aria-current={i === at ? "true" : undefined}
              className={cn(
                "tap relative size-16 shrink-0 overflow-hidden rounded-lg ring-offset-2 ring-offset-paper focus-visible:outline-2 focus-visible:outline-electric-600 sm:size-[4.5rem]",
                i === at ? "ring-2 ring-navy" : "opacity-70 hover:opacity-100",
              )}
            >
              <img src={p.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <p className="hidden text-xs text-slate lg:block">Tip: use the ← and → keys to move between photos.</p>

      {reporting && <ReportDialog photoId={photo.id} onClose={() => setReporting(false)} />}
    </section>
  );
}

function ReportDialog({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [more, setMore] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const send = () => {
    if (viewingAs()) return setMsg({ ok: false, text: "You're viewing as someone else, so nothing was sent." });
    start(async () => {
      const r = await reportPhoto(photoId, [reason, more.trim()].filter(Boolean).join(": ").slice(0, 300));
      setMsg({ ok: r.ok, text: r.ok ? "Thank you. The photo is hidden while the committee takes a look." : (r.error ?? "Something went wrong.") });
    });
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink shadow-[0_40px_90px_-30px_rgba(12,24,44,0.7)] backdrop:bg-midnight/60 backdrop:backdrop-blur-[2px] open:animate-[enter-pop_0.35s_var(--ease-out-expo)] motion-reduce:open:animate-none"
    >
      <div className="flex items-start justify-between gap-3 border-b border-navy/10 px-5 py-4">
        <h2 id={titleId} className="font-display text-xl">
          Ask for this photo to be taken down
        </h2>
        <button type="button" onClick={() => dialog.current?.close()} className="tap -mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-slate hover:bg-paper-200" aria-label="Close">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {msg?.ok ? (
        <div className="space-y-4 px-5 py-5">
          <p role="status" className="text-sm text-slate-700">
            {msg.text}
          </p>
          <button type="button" onClick={() => {
              dialog.current?.close();
              router.refresh();
            }} className="tap inline-flex min-h-12 w-full items-center justify-center rounded-full bg-navy px-5 font-ui text-sm font-semibold text-paper">
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-4 px-5 py-5">
          <p className="text-sm text-slate-700">The photo is hidden straight away and the committee will decide whether it comes back. They won&apos;t tell anyone who asked.</p>
          <fieldset className="grid gap-2">
            <legend className="sr-only">Why?</legend>
            {REASONS.map((r) => (
              <label key={r} className={cn("tap flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2 text-sm font-medium", reason === r ? "border-navy bg-paper-200 text-ink" : "border-navy/10 text-slate-700")}>
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-navy)]" />
                {r}
              </label>
            ))}
          </fieldset>
          <div>
            <label htmlFor={`${titleId}-more`} className="text-sm font-semibold">
              Anything to add? <span className="font-normal text-slate">(optional)</span>
            </label>
            <textarea id={`${titleId}-more`} value={more} onChange={(e) => setMore(e.target.value)} maxLength={200} rows={2} className="mt-1.5 w-full rounded-xl border border-navy/15 p-3 text-sm" />
          </div>
          {msg && !msg.ok && (
            <p role="alert" className="text-sm font-medium text-danger">
              {msg.text}
            </p>
          )}
          <button type="button" onClick={send} disabled={pending} className="tap inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-navy px-5 font-ui text-sm font-semibold text-paper disabled:opacity-60">
            {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Hide it and tell the committee
          </button>
        </div>
      )}
    </dialog>
  );
}
