"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GalleryAsset } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Masonry gallery with year filters and a keyboard-navigable full-screen lightbox. */
export function Gallery({ assets }: { assets: GalleryAsset[] }) {
  const years = useMemo(() => [...new Set(assets.map((a) => a.year))].sort((a, b) => b - a), [assets]);
  const [year, setYear] = useState<number | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const shown = useMemo(() => assets.filter((a) => year == null || a.year === year), [assets, year]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setIndex(null);
    requestAnimationFrame(() => opener.current?.focus());
  }, []);
  const step = useCallback((d: number) => setIndex((i) => (i == null ? i : (i + d + shown.length) % shown.length)), [shown.length]);

  useEffect(() => {
    if (index == null) return;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [index, close, step]);

  if (!assets.length) {
    return (
      <div className="rounded-xl border border-dashed border-navy/20 bg-white px-6 py-20 text-center">
        <h2 className="font-display text-2xl font-semibold text-ink">The gallery is waiting for its first photographs</h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-700">
          Approved photographs and video from INSPIRE conferences will appear here. We only publish genuine INSPIRE media, with the
          appropriate permissions.
        </p>
      </div>
    );
  }

  const current = index == null ? null : shown[index];

  return (
    <>
      {years.length > 1 && (
        <div role="group" aria-label="Filter by conference year" className="mb-8 flex flex-wrap gap-2">
          {[null, ...years].map((y) => (
            <button key={y ?? "all"} type="button" aria-pressed={year === y} onClick={() => setYear(y)} className={cn("min-h-10 rounded-full px-4 text-sm font-medium", year === y ? "bg-navy text-paper" : "border border-navy/15 bg-white text-ink")}>
              {y ?? "All years"}
            </button>
          ))}
        </div>
      )}
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {shown.map((a, i) => (
          <li key={a.id} className="mb-4 break-inside-avoid">
            <button
              type="button"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setIndex(i);
              }}
              className="group relative block w-full overflow-hidden rounded-lg bg-navy"
              aria-label={`Open ${a.alt || a.caption || "image"} in full screen`}
            >
              <Image src={a.thumbnailUrl ?? a.url} alt={a.alt} width={a.width} height={a.height} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.03]" />
              {a.caption && (
                <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-midnight/90 to-transparent p-4 text-left text-sm text-paper opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                  {a.caption}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {current && (
          <motion.div role="dialog" aria-modal="true" aria-label="Image viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] flex flex-col bg-midnight/95 text-paper backdrop-blur-md">
            <div className="flex items-center justify-between p-4">
              <p className="text-sm text-paper/60" aria-live="polite">
                {index! + 1} of {shown.length}
              </p>
              <div className="flex gap-2">
                {current.downloadable && (
                  <a href={current.url} download className="flex size-11 items-center justify-center rounded-full border border-white/20" aria-label="Download image">
                    <Download className="size-5" />
                  </a>
                )}
                <button ref={closeRef} type="button" onClick={close} className="flex size-11 items-center justify-center rounded-full border border-white/20" aria-label="Close viewer">
                  <X className="size-5" />
                </button>
              </div>
            </div>
            <div className="relative flex flex-1 items-center justify-center px-4 sm:px-20">
              <motion.div key={current.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative h-full max-h-[75vh] w-full">
                <Image src={current.url} alt={current.alt} fill sizes="100vw" className="object-contain" />
              </motion.div>
              {shown.length > 1 && (
                <>
                  <button type="button" onClick={() => step(-1)} className="absolute left-2 flex size-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:left-6" aria-label="Previous image">
                    <ChevronLeft className="size-6" />
                  </button>
                  <button type="button" onClick={() => step(1)} className="absolute right-2 flex size-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:right-6" aria-label="Next image">
                    <ChevronRight className="size-6" />
                  </button>
                </>
              )}
            </div>
            <div className="p-6 text-center">
              <p className="mx-auto max-w-2xl text-paper/85">{current.caption}</p>
              {current.credit && <p className="mt-1 text-xs text-paper/50">Photo: {current.credit}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
