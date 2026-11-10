"use client";
import { AnimatePresence, m } from "motion/react";
import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export function Accordion({ items, dark = false }: { items: { id: string; title: string; body: React.ReactNode }[]; dark?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const base = useId();
  return (
    <ul className={cn("divide-y border-y", dark ? "divide-white/10 border-white/10" : "divide-navy/10 border-navy/10")}>
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <li key={it.id}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${base}-${it.id}`}
                onClick={() => setOpen(isOpen ? null : it.id)}
                className={cn("flex w-full items-center justify-between gap-6 py-6 text-left font-display text-lg font-medium sm:text-xl", dark ? "text-paper" : "text-ink")}
              >
                {it.title}
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border transition-transform duration-300", dark ? "border-white/20" : "border-navy/15", isOpen && "rotate-45")}>
                  <Plus aria-hidden className="size-4" />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <m.div
                  id={`${base}-${it.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className={cn("max-w-3xl pb-6 leading-relaxed", dark ? "text-paper/70" : "text-slate-700")}>{it.body}</div>
                </m.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
