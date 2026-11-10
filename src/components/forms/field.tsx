import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-md border bg-white px-4 py-3 text-[1rem] text-ink placeholder:text-slate/70 transition-[border-color,box-shadow] focus:outline-none focus:ring-4 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15 border-navy/15 focus:border-electric-600 focus:ring-electric/15 disabled:bg-paper-200";

export function Field({ id, label, hint, error, required, children, className }: { id: string; label: string; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : <span className="font-normal text-slate"> (optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="-mt-1 mb-2 text-sm text-slate">{hint}</p>}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: boolean) {
  return cn(hint && `${id}-hint`, error && `${id}-error`) || undefined;
}
