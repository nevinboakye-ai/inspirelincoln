"use client";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible side drawer (bottom sheet on small screens): focus is moved in,
 * trapped, and restored on close; Escape and backdrop click close it.
 */
export function Drawer({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement;
    document.documentElement.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus], button")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
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
      document.documentElement.style.overflow = "";
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75]">
          <motion.div
            className="absolute inset-0 bg-midnight/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 40 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl max-sm:inset-x-0 max-sm:top-auto max-sm:h-[88svh] max-sm:max-w-none max-sm:rounded-t-xl"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex size-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm ring-1 ring-navy/10 hover:bg-paper-200"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
