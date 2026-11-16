"use client";
import { AnimatePresence, m } from "motion/react";
import { ChevronDown, Info, MessageCircle, PencilLine, Users } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

const OPEN = { height: "auto", opacity: 1 };
const SHUT = { height: 0, opacity: 0 };
const EASE = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const };

/**
 * The network's heading. The welcome text used to fill the top of the page,
 * so it now sits behind an "About the network" toggle, closed to start with.
 */
export function NetworkIntro({ canMessage }: { canMessage: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <header className="relative overflow-hidden rounded-xl bg-midnight text-paper">
      <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-8 -right-4 h-36 w-auto opacity-[0.07] sm:h-40" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4 sm:px-7 sm:py-5">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2 text-gold">
            <Users aria-hidden className="size-4" />
            Delegate network
          </p>
          <h1 className="mt-1.5 font-display text-2xl leading-tight sm:text-3xl">Meet who&apos;s coming</h1>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 font-ui text-sm font-semibold text-paper ring-1 ring-white/15 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <Info aria-hidden className="size-4 text-gold-300" />
          About the network
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div id={id} initial={SHUT} animate={OPEN} exit={SHUT} transition={EASE} className="relative overflow-hidden">
            <div className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-7 sm:pb-6">
              <p className="max-w-2xl text-sm leading-relaxed text-paper/80 sm:text-base">
                Everyone at INSPIRE is a medical student, so this is a rare chance to meet people on the same path as you from other medical schools. Make friends, swap details and stay in touch long after the day. Add a short bio and your LinkedIn so people can find you.
              </p>
              {canMessage && (
                <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm leading-relaxed text-paper/80">
                  <MessageCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-300" />
                  <span>Tap the message button on someone&apos;s card, or open their profile, to send them a message. Your conversations are in Messages.</span>
                </p>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/**
 * "Your card" folds down to one line with an Edit button, so the directory
 * starts near the top of the page. It nudges you to add a bio if you
 * haven't.
 */
export function YourCardPanel({ hasBio, children }: { hasBio: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const status = hasBio ? "Listed on the network." : "Listed, but you haven't added a bio yet.";
  return (
    <section className="overflow-hidden rounded-xl border border-navy/10 bg-white" aria-labelledby={`${id}-title`}>
      <div className="flex items-center gap-3 px-5 py-4 sm:gap-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="font-display text-lg text-ink sm:text-xl">
            Your card
          </h2>
          <p className="mt-0.5 flex items-start gap-2 text-sm leading-snug text-slate-700">
            <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", hasBio ? "bg-success" : "bg-gold")} />
            {status}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[3px] border border-navy/15 bg-white px-3.5 font-ui text-sm font-semibold text-ink transition-colors hover:border-navy/35 sm:px-4"
        >
          <PencilLine aria-hidden className="size-4" />
          {open ? "Close" : <>Edit<span className="hidden sm:inline"> your card</span></>}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-300 motion-reduce:transition-none", open && "rotate-180")} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <m.div id={id} initial={SHUT} animate={OPEN} exit={SHUT} transition={EASE} className="overflow-hidden">
            <div className="border-t border-navy/10 px-5 pb-6 pt-5 sm:px-6">
              <p className="mb-5 text-sm text-slate-700">Your name, university and year are shown to other confirmed delegates. Everything else is up to you.</p>
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
