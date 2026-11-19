"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock } from "lucide-react";
import { submitResearch } from "@/app/portal/research/actions";
import { STAGE_LABEL, sectionApplies, sectionTitle, sectionsFor, textFor, type Answers, type Item, type Stage } from "@/lib/research/instrument";
import { cn } from "@/lib/cn";

const draftKey = (stage: Stage, code: string | null) => `inspire-research:${code ?? "preview"}:${stage}`;

function readDraft(key: string): { answers: Answers; startedAt: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" && d.answers && typeof d.startedAt === "string" ? d : null;
  } catch {
    return null;
  }
}

function isAnswered(item: Item, v: Answers[string] | undefined) {
  if (item.optional) return true;
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v !== "";
}

/**
 * One questionnaire, a section at a time. Answers are kept on this device
 * until submitted (so a closed tab loses nothing) and only leave it on
 * submit, when the server checks every answer again.
 */
export function Questionnaire({ stage, code, preview = false }: { stage: Stage; code: string | null; preview?: boolean }) {
  const router = useRouter();
  const key = draftKey(stage, code);
  const [answers, setAnswers] = useState<Answers>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Restore a draft after hydration (localStorage isn't available on the server).
  useEffect(() => {
    const d = preview ? null : readDraft(key);
    const start = d?.startedAt ?? new Date().toISOString();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read once after hydration
    if (d) setAnswers(d.answers);
    setStartedAt(start);
  }, [key, preview]);

  useEffect(() => {
    if (preview || !startedAt) return;
    try {
      localStorage.setItem(key, JSON.stringify({ answers, startedAt }));
    } catch {}
  }, [answers, startedAt, key, preview]);

  const sections = useMemo(() => sectionsFor(stage).filter((s) => sectionApplies(s, answers)), [stage, answers]);
  const at = Math.min(index, sections.length - 1);
  const section = sections[at];
  const last = at === sections.length - 1;

  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [at]);

  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setMissing((m) => m.filter((x) => x !== id));
  };

  const go = (to: number) => {
    moved.current = true;
    setIndex(to);
  };

  const next = () => {
    const gaps = section.items.filter((i) => !isAnswered(i, answers[i.id])).map((i) => i.id);
    if (gaps.length) {
      setMissing(gaps);
      setError(gaps.length === 1 ? "Please answer the highlighted question." : `Please answer the ${gaps.length} highlighted questions.`);
      document.getElementById(`q-${gaps[0]}`)?.focus();
      return;
    }
    setError(null);
    if (!last) return go(at + 1);
    if (preview) {
      setError("This is a preview, so nothing was saved.");
      return;
    }
    startSaving(async () => {
      const r = await submitResearch({ stage, answers, startedAt });
      if (!r.ok) {
        setError(r.error ?? "We couldn't save your answers. Please try again.");
        if (r.item) {
          const back = sections.findIndex((s) => s.items.some((i) => i.id === r.item));
          if (back >= 0) {
            setMissing([r.item]);
            go(back);
          }
        }
        return;
      }
      try {
        localStorage.removeItem(key);
      } catch {}
      router.push(`/portal/research?done=${stage}`);
    });
  };

  if (!section) return null;
  const intro = section.intro ? textFor(section.intro, stage) : null;
  const pct = Math.round((at / sections.length) * 100);

  return (
    <div className="space-y-4">
      <div className="app-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
          <p className="eyebrow text-slate">
            {STAGE_LABEL[stage].short} · Part {at + 1} of {sections.length}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate">
            <Lock aria-hidden className="size-3.5" /> Stored under your study code
          </p>
        </div>
        <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-navy/10 sm:mx-6" role="progressbar" aria-label="Progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="px-4 pb-5 pt-4 sm:px-6">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl text-ink outline-none">
            {sectionTitle(section, stage)}
          </h2>
          {intro && <p className="mt-1.5 max-w-2xl text-sm text-slate-700">{intro}</p>}
        </div>
      </div>

      <ol className="space-y-3">
        {section.items.map((item, n) => (
          <li key={item.id}>
            <Question item={item} stage={stage} number={n + 1} value={answers[item.id]} onChange={(v) => set(item.id, v)} flagged={missing.includes(item.id)} />
          </li>
        ))}
      </ol>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 lg:bottom-4">
        <div className="app-card flex flex-wrap items-center gap-3 p-3">
          {error && (
            <p role="alert" className="w-full text-sm font-medium text-danger">
              {error}
            </p>
          )}
          {at > 0 && (
            <button type="button" onClick={() => go(at - 1)} className="tap inline-flex min-h-12 items-center gap-2 rounded-full border border-navy/15 px-5 font-ui text-sm font-semibold text-ink">
              <ArrowLeft aria-hidden className="size-4" /> Back
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className="tap ml-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-ui text-sm font-semibold text-paper disabled:opacity-60"
          >
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : last ? <Check aria-hidden className="size-4" /> : null}
            {last ? (preview ? "Finish preview" : "Submit answers") : "Next"}
            {!last && <ArrowRight aria-hidden className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Question({ item, stage, number, value, onChange, flagged }: { item: Item; stage: Stage; number: number; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void; flagged: boolean }) {
  const id = useId();
  const text = textFor(item.text, stage);
  const hintId = `${id}-hint`;
  return (
    <fieldset
      id={`q-${item.id}`}
      tabIndex={-1}
      aria-describedby={item.hint ? hintId : undefined}
      aria-invalid={flagged || undefined}
      className={cn("app-card min-w-0 p-4 outline-none sm:p-5", flagged && "ring-2 ring-danger/60")}
    >
      <legend className="sr-only">{text}</legend>
      <p aria-hidden className="flex gap-2 text-[0.95rem] font-semibold leading-snug text-ink">
        <span className="font-ui text-slate">{number}.</span>
        <span>
          {text}
          {item.optional && <span className="ml-1 font-normal text-slate">(optional)</span>}
        </span>
      </p>
      {item.hint && (
        <p id={hintId} className="mt-1 text-sm text-slate-700">
          {item.hint}
        </p>
      )}
      <div className="mt-3">
        {item.kind === "scale" ? (
          <ScaleInput item={item} value={typeof value === "string" ? value : undefined} onChange={onChange} name={id} />
        ) : item.kind === "single" ? (
          <div className="grid gap-2">
            {item.options.map((o) => {
              const on = value === o.value;
              return (
                <label key={o.value} className={cn("tap flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm", on ? "border-navy bg-navy/[0.04] text-ink" : "border-navy/12 text-slate-700 hover:border-navy/30")}>
                  <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value)} className="size-4 shrink-0 accent-[var(--color-navy)]" />
                  <span>{o.label}</span>
                </label>
              );
            })}
          </div>
        ) : item.kind === "multi" ? (
          <div className="grid gap-2">
            {item.options.map((o) => {
              const list = Array.isArray(value) ? value : [];
              const on = list.includes(o.value);
              const toggle = () => {
                if (on) return onChange(list.filter((x) => x !== o.value));
                if (o.value === item.exclusive) return onChange([o.value]);
                onChange([...list.filter((x) => x !== item.exclusive), o.value]);
              };
              return (
                <label key={o.value} className={cn("tap flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm", on ? "border-navy bg-navy/[0.04] text-ink" : "border-navy/12 text-slate-700 hover:border-navy/30")}>
                  <input type="checkbox" checked={on} onChange={toggle} className="size-4 shrink-0 accent-[var(--color-navy)]" />
                  <span>{o.label}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <textarea
            aria-label={text}
            value={typeof value === "string" ? value : ""}
            maxLength={item.maxLength}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-navy/15 p-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-electric-600"
            placeholder="Please don't include names or anything that could identify you or anyone else."
          />
        )}
      </div>
    </fieldset>
  );
}

/** 0 to 10 as a row of buttons with no default, so nobody is nudged towards a number. */
function ScaleInput({ item, value, onChange, name }: { item: Extract<Item, { kind: "scale" }>; value: string | undefined; onChange: (v: string) => void; name: string }) {
  const points = Array.from({ length: item.max - item.min + 1 }, (_, i) => String(item.min + i));
  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((p) => {
          const on = value === p;
          return (
            <label key={p} className={cn("tap relative grid min-h-11 cursor-pointer place-items-center rounded-lg border font-ui text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric-600", on ? "border-navy bg-navy text-paper" : "border-navy/15 text-ink hover:border-navy/40")}>
              <input type="radio" name={name} value={p} checked={on} onChange={() => onChange(p)} className="sr-only" aria-label={`${p}${p === String(item.min) ? `, ${item.minLabel}` : p === String(item.max) ? `, ${item.maxLabel}` : ""}`} />
              {p}
            </label>
          );
        })}
      </div>
      <div aria-hidden className="mt-1.5 flex justify-between text-xs text-slate">
        <span>{item.minLabel}</span>
        <span>{item.maxLabel}</span>
      </div>
    </div>
  );
}
