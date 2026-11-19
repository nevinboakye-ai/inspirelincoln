"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock } from "lucide-react";
import { submitResearch } from "@/app/portal/research/actions";
import { STAGE_LABEL, itemApplies, sectionApplies, sectionTitle, sectionsFor, textFor, type Answers, type Item, type Stage } from "@/lib/research/instrument";
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
 * One questionnaire, one question per screen so there is next to no
 * scrolling on a phone. Choosing an answer to a one-choice question or a
 * scale moves on by itself; "choose all that apply" and free text have a
 * Next button. Answers are kept on this device until submitted (so a closed
 * tab loses nothing) and only leave it on submit, when the server checks
 * every answer again.
 */
export function Questionnaire({ stage, code, preview = false }: { stage: Stage; code: string | null; preview?: boolean }) {
  const router = useRouter();
  const key = draftKey(stage, code);
  const [answers, setAnswers] = useState<Answers>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Every question that applies, given the answers so far, in order.
  const steps = useMemo(
    () =>
      sectionsFor(stage)
        .filter((sec) => sectionApplies(sec, answers))
        .flatMap((sec) => sec.items.filter((item) => itemApplies(item, answers)).map((item) => ({ section: sec, item }))),
    [stage, answers],
  );
  const at = Math.min(index, steps.length - 1);
  const step = steps[at];
  const last = at === steps.length - 1;

  useEffect(() => {
    if (!moved.current) return;
    top.current?.focus({ preventScroll: true });
    const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 80;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [at]);

  const go = (to: number) => {
    if (timer.current) clearTimeout(timer.current);
    moved.current = true;
    setFlagged(false);
    setError(null);
    setIndex(to);
  };

  const submit = () => {
    if (preview) {
      setError("This is a preview, so nothing was saved.");
      return;
    }
    startSaving(async () => {
      const r = await submitResearch({ stage, answers, startedAt });
      if (!r.ok) {
        setError(r.error ?? "We couldn't save your answers. Please try again.");
        if (r.item) {
          const back = steps.findIndex((x) => x.item.id === r.item);
          if (back >= 0) {
            go(back);
            setFlagged(true);
            setError(r.error ?? null);
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

  const next = () => {
    if (!isAnswered(step.item, answers[step.item.id])) {
      setFlagged(true);
      setError("Please answer this question to carry on.");
      return;
    }
    if (last) return submit();
    go(at + 1);
  };

  const set = (v: Answers[string], advance: boolean) => {
    setAnswers((a) => ({ ...a, [step.item.id]: v }));
    setFlagged(false);
    setError(null);
    // One tap answers a one-choice question or a scale: move on after a beat, so the choice is seen.
    if (advance && !last) {
      if (timer.current) clearTimeout(timer.current);
      const from = at;
      timer.current = setTimeout(() => go(from + 1), 260);
    }
  };

  if (!step) return null;
  const { section, item } = step;
  const firstOfSection = at === 0 || steps[at - 1].section.id !== section.id;
  const intro = section.intro && firstOfSection ? textFor(section.intro, stage) : null;
  const pct = Math.round(((at + (isAnswered(item, answers[item.id]) ? 1 : 0)) / steps.length) * 100);
  const needsButton = item.kind === "multi" || item.kind === "text" || last || isAnswered(item, answers[item.id]);

  return (
    <div ref={top} tabIndex={-1} className="space-y-3 outline-none">
      <div className="app-card px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow text-slate">
            <span className="hidden sm:inline">{STAGE_LABEL[stage].short} · </span>Question {at + 1} of {steps.length}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate">
            <Lock aria-hidden className="size-3.5" /> <span className="hidden sm:inline">Stored under your study code</span>
            <span className="sm:hidden">Private</span>
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy/10" role="progressbar" aria-label="Progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div key={item.id} className="animate-[enter-pop_0.35s_var(--ease-out-expo)] motion-reduce:animate-none">
        <p className="px-1 font-ui text-xs font-semibold uppercase tracking-[0.14em] text-electric-600">{sectionTitle(section, stage)}</p>
        {intro && <p className="mt-1 px-1 text-sm text-slate-700">{intro}</p>}
        <div className="mt-2">
          <Question item={item} stage={stage} number={at + 1} value={answers[item.id]} onChange={set} flagged={flagged} />
        </div>
      </div>

      {error && (
        <p role="alert" className="px-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        {at > 0 && (
          <button type="button" onClick={() => go(at - 1)} className="tap inline-flex min-h-12 items-center gap-2 rounded-full border border-navy/15 px-5 font-ui text-sm font-semibold text-ink">
            <ArrowLeft aria-hidden className="size-4" /> Back
          </button>
        )}
        {needsButton && (
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className="tap ml-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-6 font-ui text-sm font-semibold text-paper disabled:opacity-60"
          >
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : last ? <Check aria-hidden className="size-4" /> : null}
            {last ? (preview ? "Finish preview" : "Submit answers") : item.optional && !isAnswered({ ...item, optional: false }, answers[item.id]) ? "Skip" : "Next"}
            {!last && <ArrowRight aria-hidden className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function Question({ item, stage, number, value, onChange, flagged }: { item: Item; stage: Stage; number: number; value: Answers[string] | undefined; onChange: (v: Answers[string], advance: boolean) => void; flagged: boolean }) {
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
          <ScaleInput item={item} value={typeof value === "string" ? value : undefined} onChange={(v) => onChange(v, true)} name={id} />
        ) : item.kind === "single" ? (
          <div className="grid gap-2">
            {item.options.map((o) => {
              const on = value === o.value;
              return (
                <label key={o.value} className={cn("tap flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm", on ? "border-navy bg-navy/[0.04] text-ink" : "border-navy/12 text-slate-700 hover:border-navy/30")}>
                  <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value, true)} className="size-4 shrink-0 accent-[var(--color-navy)]" />
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
                if (on) return onChange(list.filter((x) => x !== o.value), false);
                if (o.value === item.exclusive) return onChange([o.value], false);
                onChange([...list.filter((x) => x !== item.exclusive), o.value], false);
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
            onChange={(e) => onChange(e.target.value, false)}
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
