"use client";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useActionState, useId, useRef } from "react";
import { removeUniversityLogo, saveUniversityLogo } from "@/app/admin/university-actions";
import { UniLogo } from "@/components/ui/uni-logo";
import { viewingAs } from "@/lib/view-as-client";

/** One university: its logo (or initials), and buttons to add, replace or remove it. */
export function UniversityLogoRow({ institution, people, src }: { institution: string; people: number; src: string | null }) {
  const [saved, save, saving] = useActionState(saveUniversityLogo, null);
  const [removed, remove, removing] = useActionState(removeUniversityLogo, null);
  const form = useRef<HTMLFormElement>(null);
  const fileId = useId();
  const result = saving || removing ? null : (removed ?? saved);
  return (
    <li className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
      <UniLogo src={src} name={institution} fallback className="size-14 text-xs" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{institution}</p>
        <p className="text-sm text-slate-700">
          {people} {people === 1 ? "person" : "people"} · {src ? "Logo added" : "No logo yet, showing initials"}
        </p>
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`mt-1 text-sm font-medium ${result.ok ? "text-success" : "text-danger"}`}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
      <form ref={form} action={save} className="flex items-center gap-2">
        <input type="hidden" name="institution" value={institution} />
        <label htmlFor={fileId} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[3px] border border-navy/15 bg-white px-4 text-sm font-semibold text-ink hover:border-navy/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric-600">
          {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />}
          {src ? "Replace" : "Add logo"}
          <span className="sr-only"> for {institution}</span>
          <input
            id={fileId}
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              if (!e.target.files?.length) return;
              if (viewingAs()) return alert("You're viewing as someone else, so uploads are switched off.");
              form.current?.requestSubmit();
            }}
          />
        </label>
      </form>
      {src && (
        <form action={remove}>
          <input type="hidden" name="institution" value={institution} />
          <button className="inline-flex min-h-11 items-center gap-2 rounded-[3px] px-3 text-sm font-semibold text-danger hover:bg-danger/[0.05]">
            {removing ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />} Remove<span className="sr-only"> logo for {institution}</span>
          </button>
        </form>
      )}
    </li>
  );
}
