"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { Speaker } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { SpeakerPortrait } from "@/components/speakers/speaker-portrait";
import { PlaceholderTag } from "@/components/ui/badge";

export function SpeakerCarousel({ speakers }: { speakers: Speaker[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = () => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useEffect(update, []);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const placeholders = speakers.length === 0 ? Array.from({ length: 4 }, (_, i) => i) : [];

  return (
    <div className="mt-14">
      <ul
        ref={track}
        onScroll={update}
        aria-label="Speakers"
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:-mx-12 lg:scroll-px-12 lg:px-12 [&::-webkit-scrollbar]:hidden"
      >
        {speakers.map((s) => (
          <li key={s.id} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-[23.5%]">
            <Link href={`/speakers/${s.slug}`} className="group block">
              <SpeakerPortrait name={s.fullName} url={s.portraitUrl} className="aspect-[4/5] rounded-lg" />
              <p className="mt-5 font-display text-xl font-medium">{s.fullName}</p>
              <p className="mt-1 text-sm text-paper/60">{[s.position, s.institution].filter(Boolean).join(", ")}</p>
              {s.sessionType && <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan">{SESSION_CATEGORY_LABEL[s.sessionType]}</p>}
            </Link>
          </li>
        ))}
        {placeholders.map((i) => (
          <li key={i} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-[23.5%]">
            <div className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6">
              <div aria-hidden className="grid-lines absolute inset-0 opacity-50" />
              <svg aria-hidden viewBox="0 0 100 100" className="absolute left-1/2 top-[38%] size-28 -translate-x-1/2 -translate-y-1/2 text-paper/15">
                <circle cx="50" cy="36" r="18" fill="currentColor" />
                <path d="M14 96 C 18 66, 82 66, 86 96" fill="currentColor" />
              </svg>
              <div className="relative">
                <PlaceholderTag dark>Placeholder</PlaceholderTag>
                <p className="mt-3 font-display text-lg font-medium text-paper/85">Speaker announcement coming soon</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-paper/65">
          {speakers.length === 0 ? "Speakers will appear here once confirmed by the conference team." : `${speakers.length} confirmed speaker${speakers.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Previous speakers" className="flex size-12 items-center justify-center rounded-full border border-white/20 transition-colors hover:border-cyan hover:text-cyan disabled:opacity-30">
            <ArrowLeft className="size-5" />
          </button>
          <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label="Next speakers" className="flex size-12 items-center justify-center rounded-full border border-white/20 transition-colors hover:border-cyan hover:text-cyan disabled:opacity-30">
            <ArrowRight className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
