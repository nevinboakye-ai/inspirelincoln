"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveWorkshopText } from "@/app/workshops/edit-actions";
import { inputClass } from "@/components/forms/field";
import { cn } from "@/lib/cn";

export type EditableWorkshop = { id: string; title: string; strapline: string | null; summary: string | null; description: string | null };

/** The form committee members use to rename a workshop and change its wording, right where it's shown. */
export function WorkshopTextEditor({ workshop, onDone, onCancel }: { workshop: EditableWorkshop; onDone?: () => void; onCancel: () => void }) {
  const router = useRouter();
  const id = useId();
  const [v, setV] = useState({ title: workshop.title, strapline: workshop.strapline ?? "", summary: workshop.summary ?? "", description: workshop.description ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const field = (k: keyof typeof v) => ({
    id: `${id}-${k}`,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value })),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const r = await saveWorkshopText({ id: workshop.id, ...v });
      if (r?.ok) {
        router.refresh();
        onDone?.();
      } else setError(r?.error ?? "We couldn't save that. Please try again.");
    });
  };
  const label = "mb-1.5 block text-sm font-semibold text-ink";
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor={`${id}-title`} className={label}>
          Name
        </label>
        <input {...field("title")} required maxLength={120} className={inputClass} data-autofocus />
      </div>
      <div>
        <label htmlFor={`${id}-strapline`} className={label}>
          Tagline <span className="font-normal text-slate-700">(one short line)</span>
        </label>
        <input {...field("strapline")} maxLength={160} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-summary`} className={label}>
          Summary <span className="font-normal text-slate-700">(shown on cards)</span>
        </label>
        <textarea {...field("summary")} maxLength={400} rows={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-description`} className={label}>
          Description
        </label>
        <textarea {...field("description")} maxLength={3000} rows={7} className={inputClass} />
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="inline-flex min-h-12 items-center gap-2 rounded-[3px] bg-navy px-6 font-ui text-sm font-semibold text-paper hover:bg-navy-700 disabled:opacity-60" disabled={pending}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />} Save changes
        </button>
        <button type="button" onClick={onCancel} className={cn("min-h-12 rounded-[3px] border border-navy/20 bg-white px-5 font-ui text-sm font-semibold text-ink hover:bg-paper-200")}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-slate-700">Changes show on the website straight away. Topics, outcomes and everything else are in Website, Workshops.</p>
    </form>
  );
}
