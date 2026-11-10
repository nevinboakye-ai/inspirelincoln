"use client";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import type { CommitteeMember } from "@/lib/types";
import { SpeakerPortrait } from "@/components/speakers/speaker-portrait";
import { cn } from "@/lib/cn";

/** Expandable committee directory. Profiles are managed in /admin. */
export function CommitteeDirectory({ members }: { members: CommitteeMember[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!members.length) {
    return (
      <div className="rounded-xl border border-dashed border-navy/20 bg-white p-10 text-center">
        <p className="font-display text-xl font-medium text-ink">Committee profiles coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-slate-700">The INSPIRE committee will be introduced here once profiles have been approved.</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => {
        const isOpen = open === m.id;
        return (
          <li key={m.id} className={cn("overflow-hidden rounded-lg border bg-white transition-shadow", isOpen ? "border-navy/25 shadow-lg" : "border-navy/10")}>
            <button type="button" aria-expanded={isOpen} aria-controls={`cm-${m.id}`} onClick={() => setOpen(isOpen ? null : m.id)} className="group flex w-full items-center gap-4 p-4 text-left">
              {m.photoUrl ? (
                <span className="relative size-16 shrink-0 overflow-hidden rounded-full">
                  <Image src={m.photoUrl} alt="" fill sizes="64px" className="object-cover" />
                </span>
              ) : (
                <SpeakerPortrait name={m.name} url={null} className="size-16 shrink-0 rounded-full [&_span]:text-lg" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-medium text-ink">{m.name}</span>
                <span className="block text-sm text-electric-600">{m.role}</span>
                {m.institution && <span className="block truncate text-sm text-slate">{m.institution}</span>}
              </span>
              <Plus aria-hidden className={cn("size-5 shrink-0 text-slate transition-transform", isOpen && "rotate-45")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div id={`cm-${m.id}`} initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="border-t border-navy/10 p-5 text-[0.95rem] leading-relaxed text-slate-700">
                    {m.bio ?? "Biography to follow."}
                    {m.links.length > 0 && (
                      <ul className="mt-4 flex flex-wrap gap-3">
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
          </li>
        );
      })}
    </ul>
  );
}
