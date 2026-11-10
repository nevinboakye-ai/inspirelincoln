"use client";
import Image from "next/image";
import { AnimatePresence, m as motion } from "motion/react";
import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import type { CommitteeMember } from "@/lib/types";
import { SpeakerPortrait } from "@/components/speakers/speaker-portrait";
import { cn } from "@/lib/cn";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Portrait directory of the committee. Profiles are managed in /admin. */
export function CommitteeDirectory({ members }: { members: CommitteeMember[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!members.length) {
    return (
      <div className="rounded-[3px] border border-dashed border-navy/20 bg-white p-10 text-center">
        <p className="font-display text-xl font-medium text-ink">Committee profiles coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-slate-700">The INSPIRE committee will be introduced here once profiles have been approved.</p>
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
      {members.map((m, i) => {
        const isOpen = open === m.id;
        const hasMore = Boolean(m.bio) || m.links.length > 0;
        return (
          <li key={m.id} className="group">
            <div className="relative aspect-[4/5] overflow-hidden bg-paper-200">
              {m.photoUrl ? (
                <Image
                  src={m.photoUrl}
                  alt={`${m.name}, ${m.role}`}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover object-top grayscale-[35%] transition duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03] group-hover:grayscale-0"
                />
              ) : (
                <SpeakerPortrait name={m.name} url={null} className="absolute inset-0" />
              )}
              <span aria-hidden className="absolute left-0 top-0 bg-navy px-2.5 py-1.5 font-display text-sm italic text-paper">
                {NUMERALS[i] ?? i + 1}
              </span>
            </div>
            <div className="mt-4 border-t border-navy/15 pt-3">
              <p className="font-display text-xl leading-tight text-ink">{m.name}</p>
              <p className="mt-1 font-ui text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-electric-600">{m.role}</p>
              {m.institution && <p className="mt-1 text-sm text-slate">{m.institution}</p>}
              {hasMore && (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`cm-${m.id}`}
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-ink"
                >
                  <Plus aria-hidden className={cn("size-4 transition-transform", isOpen && "rotate-45")} /> {isOpen ? "Less" : "More"}
                  <span className="sr-only"> about {m.name}</span>
                </button>
              )}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div id={`cm-${m.id}`} initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="pt-2 text-[0.95rem] leading-relaxed text-slate-700">
                      {m.bio}
                      {m.links.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-3">
                          {m.links.map((l) => (
                            <li key={l.url}>
                              <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-electric-600">
                                {l.label} <ExternalLink aria-hidden className="size-3.5" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
