"use client";
import { submitWithoutReset } from "@/lib/use-action-form";
import { useActionState, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { deleteEntity, saveEntity } from "@/app/admin/actions";
import { getEntity, type FieldDef } from "@/lib/admin/entities";
import { Field, inputClass } from "@/components/forms/field";
import { ResultBanner } from "@/components/portal/profile-forms";
import { toZonedInputValue } from "@/lib/time";
import { btn } from "./ui";
import { cn } from "@/lib/cn";

function initialValue(f: FieldDef, v: unknown): string {
  if (v == null) return "";
  switch (f.type) {
    case "datetime": return toZonedInputValue(String(v));
    case "lines": return Array.isArray(v) ? v.join("\n") : "";
    case "links": return Array.isArray(v) ? (v as { label: string; url: string }[]).map((l) => `${l.label} | ${l.url}`).join("\n") : "";
    case "time": return String(v).slice(0, 5);
    default: return String(v);
  }
}

function Input({ f, row, relations, error }: { f: FieldDef; row: Record<string, unknown> | null; relations: Record<string, { value: string; label: string }[]>; error?: string }) {
  const v = row?.[f.name];
  const common = { id: f.name, name: f.name, "aria-invalid": Boolean(error), "aria-describedby": error ? `${f.name}-error` : f.hint ? `${f.name}-hint` : undefined };
  const [preview, setPreview] = useState(typeof v === "string" ? v : "");
  if (f.type === "boolean")
    return (
      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700 sm:col-span-2">
        <input type="checkbox" name={f.name} defaultChecked={row ? Boolean(v) : f.name === "is_provisional"} className="size-5 accent-electric-600" /> {f.label}
      </label>
    );
  const control = (() => {
    switch (f.type) {
      case "textarea":
      case "lines":
      case "links":
        return <textarea {...common} rows={f.type === "textarea" ? 5 : 4} defaultValue={initialValue(f, v)} className={inputClass} />;
      case "select":
        return (
          <select {...common} defaultValue={initialValue(f, v) || (f.required ? f.options?.[0]?.value : "")} className={inputClass}>
            {!f.required && <option value="">None</option>}
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "relation":
        return (
          <select {...common} defaultValue={initialValue(f, v)} className={inputClass}>
            <option value="">None</option>
            {relations[f.name]?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "speakers": {
        const chosen = new Set(Array.isArray(v) ? (v as string[]) : []);
        const opts = relations[f.name] ?? [];
        return opts.length ? (
          <div className="grid max-h-60 gap-1 overflow-y-auto rounded-md border border-navy/15 p-3 sm:grid-cols-2">
            {opts.map((o) => (
              <label key={o.value} className="flex min-h-10 items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name={f.name} value={o.value} defaultChecked={chosen.has(o.value)} className="size-4 accent-electric-600" /> {o.label}
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate">No speakers yet. Add speakers first.</p>
        );
      }
      case "image":
        return (
          <div className="space-y-3">
            {preview && /^https?:\/\//.test(preview) && (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary URLs
              <img src={preview} alt="" className="h-32 w-auto rounded-md border border-navy/10 object-cover" />
            )}
            <input {...common} type="url" defaultValue={initialValue(f, v)} onChange={(e) => setPreview(e.target.value)} placeholder="https://… or upload below" className={inputClass} />
            <input name={`${f.name}__file`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label={`Upload ${f.label.toLowerCase()}`} className="block w-full text-sm text-slate-700 file:mr-4 file:min-h-10 file:rounded-full file:border-0 file:bg-navy file:px-4 file:font-semibold file:text-paper" />
          </div>
        );
      case "number":
        return <input {...common} type="number" step="any" defaultValue={initialValue(f, v)} className={inputClass} />;
      case "date":
        return <input {...common} type="date" defaultValue={initialValue(f, v)} className={inputClass} />;
      case "time":
        return <input {...common} type="time" defaultValue={initialValue(f, v)} className={inputClass} />;
      case "datetime":
        return <input {...common} type="datetime-local" defaultValue={initialValue(f, v)} className={inputClass} />;
      case "url":
        return <input {...common} type="url" defaultValue={initialValue(f, v)} placeholder="https://" className={inputClass} />;
      default:
        return <input {...common} type="text" defaultValue={initialValue(f, v)} className={inputClass} />;
    }
  })();
  return (
    <Field id={f.name} label={f.label} required={f.required} hint={f.hint} error={error} className={cn(f.wide || f.type === "speakers" || f.type === "image" ? "sm:col-span-2" : "")}>
      {control}
    </Field>
  );
}

export function EntityForm({ entityKey, id, row, relations }: { entityKey: string; id: string | null; row: Record<string, unknown> | null; relations: Record<string, { value: string; label: string }[]> }) {
  const entity = getEntity(entityKey)!;
  const [state, action, pending] = useActionState(saveEntity, null);
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="rounded-xl border border-navy/10 bg-white p-6 sm:p-8">
      <ResultBanner state={state} />
      <input type="hidden" name="__entity" value={entity.key} />
      {id && <input type="hidden" name="__id" value={id} />}
      <div className="grid gap-5 sm:grid-cols-2">
        {entity.fields.map((f) => <Input key={f.name} f={f} row={row} relations={relations} error={state?.fieldErrors?.[f.name]} />)}
      </div>
      <div className="mt-8 flex gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />} Save
        </button>
      </div>
    </form>
  );
}

export function DeleteEntity({ entityKey, id, singular }: { entityKey: string; id: string; singular: string }) {
  const [state, action, pending] = useActionState(deleteEntity, null);
  const [confirm, setConfirm] = useState(false);
  return (
    <form onSubmit={submitWithoutReset(action)} className="flex flex-wrap items-center gap-3">
      <ResultBanner state={state} />
      <input type="hidden" name="__entity" value={entityKey} />
      <input type="hidden" name="__id" value={id} />
      {confirm ? (
        <>
          <span className="text-sm text-slate-700">Delete this {singular} permanently?</span>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-danger px-5 text-sm font-semibold text-white">Delete</button>
          <button type="button" onClick={() => setConfirm(false)} className={btn.secondary}>Cancel</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className={btn.danger}><Trash2 aria-hidden className="size-4" /> Delete {singular}</button>
      )}
    </form>
  );
}
