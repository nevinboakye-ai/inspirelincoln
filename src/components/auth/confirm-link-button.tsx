"use client";
import { useFormStatus } from "react-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function ConfirmLinkButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      autoFocus
      className="group flex min-h-14 w-full items-center justify-center gap-2 rounded-[3px] bg-navy text-lg font-ui font-semibold text-paper shadow-[0_10px_30px_-12px_rgba(12,24,44,0.6)] transition hover:bg-navy-700 active:scale-[0.99] disabled:opacity-70"
    >
      {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
      {pending ? "One moment…" : children}
      {!pending && <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />}
    </button>
  );
}
