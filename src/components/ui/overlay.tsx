"use client";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { lockScroll } from "@/lib/scroll-lock";

/**
 * The part of the screen not covered by the on-screen keyboard. Phones
 * (iPhone especially) keep fixed elements where they were when the keyboard
 * opens, so a bottom sheet ends up behind it. Null where it doesn't apply.
 */
function useVisibleViewport(active: boolean) {
  const [vv, setVv] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const v = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !v) return;
    const update = () => {
      // Only step in when something (the keyboard) is actually covering the page.
      const covered = window.innerHeight - v.height > 80;
      setVv(covered ? { top: v.offsetTop, height: v.height } : null);
    };
    update();
    v.addEventListener("resize", update);
    v.addEventListener("scroll", update);
    return () => {
      v.removeEventListener("resize", update);
      v.removeEventListener("scroll", update);
      setVv(null);
    };
  }, [active]);
  return vv;
}

/**
 * A card that opens over the page (a bottom sheet on phones). Focus moves
 * in, stays inside, and goes back to where it was on close; Escape and a
 * tap on the backdrop close it.
 */
export function Overlay({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const vv = useVisibleViewport(open);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    const release = lockScroll();
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus() ?? panel.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!els.length) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      release();
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-x-0 top-0 z-[80] flex h-[100dvh] items-end justify-center sm:items-center sm:p-6"
          // With the keyboard open, sit in the space above it so nothing is hidden behind it.
          style={vv ? { top: vv.top, height: vv.height } : undefined}
        >
          <m.div className="absolute inset-0 bg-midnight/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <m.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={vv ? { maxHeight: vv.height - 8 } : undefined}
            className="relative flex max-h-[90svh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm ring-1 ring-navy/10 hover:bg-paper-200"
              aria-label="Close"
            >
              <X aria-hidden className="size-5" />
            </button>
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
