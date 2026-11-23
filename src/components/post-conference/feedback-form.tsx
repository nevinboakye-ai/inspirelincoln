"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Meh, PencilLine, Star, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { submitFeedback } from "@/app/portal/after/actions";
import { HIGHLIGHTS, IMPROVEMENTS, IMPROVE_NOTHING, NOTE_MAX, OVERALL, partsFor, type Phrase, type PartRating } from "@/lib/post-conference/feedback";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

type Draft = {
  overall: number | null;
  parts: Record<string, PartRating>;
  highlights: string[];
  highlightNote: string;
  improvements: string[];
  improveNote: string;
  recommend: number | null;
  comments: string;
  quoteOk: boolean;
};
const EMPTY: Draft = { overall: null, parts: {}, highlights: [], highlightNote: "", improvements: [], improveNote: "", recommend: null, comments: "", quoteOk: false };

const STEPS = ["overall", "parts", "highlights", "improvements", "recommend"] as const;
type Step = (typeof STEPS)[number];
const STEP_TONE: Record<Step, { chip: string; bar: string; card: string }> = {
  overall: { chip: "bg-gold/20 text-gold-700", bar: "bg-gold", card: "border-t-gold" },
  parts: { chip: "bg-sky-100 text-sky", bar: "bg-sky", card: "border-t-sky" },
  highlights: { chip: "bg-teal-100 text-teal", bar: "bg-teal", card: "border-t-teal" },
  improvements: { chip: "bg-coral-100 text-coral", bar: "bg-coral", card: "border-t-coral" },
  recommend: { chip: "bg-plum-100 text-plum", bar: "bg-plum", card: "border-t-plum" },
};
const STEP_LABEL: Record<Step, string> = {
  overall: "The day",
  parts: "Each part",
  highlights: "Best bits",
  improvements: "Next year",
  recommend: "Last one",
};

/** 0 to 10 tinted from cool to warm, matching the research questionnaires. */
const SCALE_TINT = ["bg-rose-100", "bg-rose-100/80", "bg-coral-100", "bg-coral-100/80", "bg-gold/15", "bg-gold/20", "bg-gold/25", "bg-teal-100/70", "bg-teal-100", "bg-sky-100", "bg-sky-100/90"];

const DRAFT_KEY = "inspire-feedback-draft";

/**
 * The post-conference feedback, one short screen at a time: a star rating
 * (one tap moves on), optional thumbs for each part of the day, tap-to-pick
 * phrases for the best bits and what to change (each with room to write
 * more), then 0 to 10 for recommending INSPIRE. Answers are kept on this
 * device until sent, so closing the tab loses nothing.
 */
export function FeedbackForm({ presenter, preview = false }: { presenter: boolean; preview?: boolean }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(EMPTY);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [saving, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = STEPS[at];
  const last = at === STEPS.length - 1;
  const tone = STEP_TONE[step];

  useEffect(() => {
    if (preview) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read once after hydration
      if (raw) setD({ ...EMPTY, ...JSON.parse(raw) });
    } catch {}
  }, [preview]);
  useEffect(() => {
    if (preview) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {}
  }, [d, preview]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (!moved.current) return;
    top.current?.focus({ preventScroll: true });
    const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 90;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [at]);

  const go = (to: number) => {
    if (timer.current) clearTimeout(timer.current);
    moved.current = true;
    setError(null);
    setFlagged(false);
    setAt(to);
  };
  const update = (patch: Partial<Draft>) => {
    setD((x) => ({ ...x, ...patch }));
    setError(null);
    setFlagged(false);
  };
  /** One tap answers it: move on after a beat, so the choice is seen. */
  const advance = () => {
    if (timer.current) clearTimeout(timer.current);
    const from = at;
    timer.current = setTimeout(() => go(from + 1), 280);
  };

  const send = () => {
    if (d.overall === null) {
      go(0);
      setFlagged(true);
      return setError("Choose a rating for the day.");
    }
    if (d.recommend === null) {
      setFlagged(true);
      return setError("Choose a number from 0 to 10.");
    }
    if (preview) return setError("This is a preview, so nothing was sent.");
    if (viewingAs()) return setError("You're viewing as someone else, so nothing was sent.");
    start(async () => {
      const r = await submitFeedback({
        overall: d.overall!,
        recommend: d.recommend!,
        parts: d.parts,
        highlights: d.highlights,
        highlightNote: d.highlightNote,
        improvements: d.improvements,
        improveNote: d.improveNote,
        comments: d.comments,
        quoteOk: d.quoteOk,
      });
      if (!r.ok) {
        if (r.step === "overall") go(0);
        setFlagged(Boolean(r.step));
        return setError(r.error ?? "We couldn't send your feedback. Please try again.");
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      router.push("/portal/after?thanks=1");
      router.refresh();
    });
  };

  const next = () => {
    if (step === "overall" && d.overall === null) {
      setFlagged(true);
      return setError("Tap a star to rate the day.");
    }
    if (last) return send();
    go(at + 1);
  };

  const optionalEmpty =
    (step === "parts" && !Object.keys(d.parts).length) ||
    (step === "highlights" && !d.highlights.length && !d.highlightNote.trim()) ||
    (step === "improvements" && !d.improvements.length && !d.improveNote.trim());
  const pct = Math.round(((at + (step === "overall" ? (d.overall ? 1 : 0) : 1)) / STEPS.length) * 100);
  const showButton = step !== "overall" || d.overall !== null;

  return (
    <div ref={top} tabIndex={-1} className="space-y-3 outline-none">
      <div className="app-card px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-ui text-sm font-semibold text-ink">
            Your feedback <span className="font-normal text-slate">· {at + 1} of {STEPS.length}</span>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-slate">
            <Lock aria-hidden className="size-3.5" /> <span className="hidden sm:inline">The committee reads it without your name</span>
            <span className="sm:hidden">No names shown</span>
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-navy/10" role="progressbar" aria-label="Progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={cn("h-full rounded-full transition-[width,background-color] duration-500", tone.bar)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div key={step} className="animate-[enter-pop_0.35s_var(--ease-out-expo)] motion-reduce:animate-none">
        <p className={cn("inline-flex rounded-full px-3 py-1 font-ui text-xs font-semibold", tone.chip)}>{STEP_LABEL[step]}</p>
        <div className={cn("app-card mt-2 min-w-0 border-t-4 p-4 sm:p-5", tone.card, flagged && "ring-2 ring-danger/60")}>
          {step === "overall" && (
            <Overall
              value={d.overall}
              onChange={(v) => {
                update({ overall: v });
                advance();
              }}
            />
          )}
          {step === "parts" && <Parts presenter={presenter} value={d.parts} onChange={(parts) => update({ parts })} />}
          {step === "highlights" && (
            <Phrases
              title="What stood out for you?"
              hint="Tap all that apply."
              list={HIGHLIGHTS}
              value={d.highlights}
              onChange={(highlights) => update({ highlights })}
              note={d.highlightNote}
              onNote={(highlightNote) => update({ highlightNote })}
              noteLabel="Tell us more about the best bits"
              tone="teal"
            />
          )}
          {step === "improvements" && (
            <Phrases
              title="What should we change next year?"
              hint="Tap all that apply."
              list={IMPROVEMENTS}
              exclusive={IMPROVE_NOTHING}
              value={d.improvements}
              onChange={(improvements) => update({ improvements })}
              note={d.improveNote}
              onNote={(improveNote) => update({ improveNote })}
              noteLabel="Tell us more about what to change"
              tone="coral"
            />
          )}
          {step === "recommend" && (
            <Recommend
              value={d.recommend}
              onChange={(recommend) => update({ recommend })}
              comments={d.comments}
              onComments={(comments) => update({ comments })}
              quoteOk={d.quoteOk}
              onQuoteOk={(quoteOk) => update({ quoteOk })}
            />
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        {at > 0 && (
          <button type="button" onClick={() => go(at - 1)} className="tap inline-flex min-h-12 items-center gap-2 rounded-full border border-navy/15 bg-white px-5 font-ui text-sm font-semibold text-ink">
            <ArrowLeft aria-hidden className="size-4" /> Back
          </button>
        )}
        {showButton && (
          <button
            type="button"
            onClick={next}
            disabled={saving}
            className={cn(
              "tap ml-auto inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-ui text-sm font-semibold disabled:opacity-60",
              last ? "bg-gradient-to-r from-navy to-navy-600 text-paper shadow-[0_10px_24px_-12px_rgba(12,24,44,0.8)]" : "bg-navy text-paper",
            )}
          >
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : last ? <Check aria-hidden className="size-4" /> : null}
            {last ? (preview ? "Finish preview" : "Send and unlock the hub") : optionalEmpty ? "Skip" : "Next"}
            {!last && <ArrowRight aria-hidden className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function Question({ children, hint, id }: { children: React.ReactNode; hint?: string; id: string }) {
  return (
    <div className="mb-3">
      <p id={id} className="text-[0.95rem] font-semibold leading-snug text-ink sm:text-base">
        {children}
      </p>
      {hint && <p className="mt-0.5 text-sm text-slate-700">{hint}</p>}
    </div>
  );
}

function Overall({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div>
      <Question id={id}>Overall, how was INSPIRE 2026?</Question>
      <div role="radiogroup" aria-labelledby={id} className="flex justify-between gap-1 sm:justify-start sm:gap-2" onPointerLeave={() => setHover(null)}>
        {OVERALL.map((o) => {
          const lit = shown !== null && o.value <= shown;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              aria-label={`${o.value} star${o.value > 1 ? "s" : ""}, ${o.label}`}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(o.value)}
              onClick={() => onChange(o.value)}
              className={cn(
                "tap grid size-14 place-items-center rounded-2xl transition-[transform,background-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600 sm:size-16",
                lit ? "bg-gold/15" : "bg-paper-200 hover:bg-gold/10",
                value === o.value && "scale-110",
              )}
            >
              <Star aria-hidden className={cn("size-8 transition-colors sm:size-9", lit ? "fill-gold text-gold-600" : "text-slate/50")} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-3 h-6 font-display text-lg text-ink">
        {shown ? OVERALL[shown - 1].label : <span className="font-ui text-sm text-slate">Tap a star</span>}
      </p>
    </div>
  );
}

const RATING_ICON = { great: ThumbsUp, ok: Meh, poor: ThumbsDown } as const;
const RATING_ON = { great: "bg-teal text-white", ok: "bg-gold text-midnight", poor: "bg-coral text-white" } as const;
const RATING_WORD = { great: "Great", ok: "OK", poor: "Poor" } as const;

function Parts({ presenter, value, onChange }: { presenter: boolean; value: Record<string, PartRating>; onChange: (v: Record<string, PartRating>) => void }) {
  const id = useId();
  return (
    <div>
      <Question id={id} hint="Only the parts you went to. Tap again to clear.">
        How was each part of the day?
      </Question>
      <p aria-hidden className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate">
        {(["great", "ok", "poor"] as const).map((r) => {
          const Icon = RATING_ICON[r];
          return (
            <span key={r} className="inline-flex items-center gap-1">
              <Icon className="size-3.5" /> {RATING_WORD[r]}
            </span>
          );
        })}
      </p>
      <ul className="divide-y divide-navy/[0.07]">
        {partsFor(presenter).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
            <span id={`${id}-${p.id}`} className="min-w-0 text-sm font-medium leading-snug text-ink">
              {p.label}
              {value[p.id] && <span className="sr-only">: {RATING_WORD[value[p.id]]}</span>}
            </span>
            <span role="radiogroup" aria-labelledby={`${id}-${p.id}`} className="flex shrink-0 gap-1 rounded-full bg-paper-200 p-1">
              {(["great", "ok", "poor"] as const).map((r) => {
                const Icon = RATING_ICON[r];
                const on = value[p.id] === r;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={RATING_WORD[r]}
                    onClick={() => {
                      const nextVal = { ...value };
                      if (on) delete nextVal[p.id];
                      else nextVal[p.id] = r;
                      onChange(nextVal);
                    }}
                    className={cn(
                      "tap grid size-10 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-electric-600",
                      on ? cn(RATING_ON[r], "shadow-sm") : "text-slate-700 hover:bg-white",
                    )}
                  >
                    <Icon aria-hidden className="size-[1.1rem]" />
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CHIP_ON = { teal: "border-teal bg-teal-100 text-ink", coral: "border-coral bg-coral-100 text-ink" } as const;

function Phrases({
  title,
  hint,
  list,
  exclusive,
  value,
  onChange,
  note,
  onNote,
  noteLabel,
  tone,
}: {
  title: string;
  hint: string;
  list: Phrase[];
  exclusive?: string;
  value: string[];
  onChange: (v: string[]) => void;
  note: string;
  onNote: (v: string) => void;
  noteLabel: string;
  tone: keyof typeof CHIP_ON;
}) {
  const id = useId();
  const [writing, setWriting] = useState(Boolean(note));
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (writing && !note) area.current?.focus();
    // Focus only when the box is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing]);
  return (
    <div>
      <Question id={id} hint={hint}>
        {title}
      </Question>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {list.map((p) => {
          const on = value.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange(on ? value.filter((x) => x !== p.id) : p.id === exclusive ? [p.id] : [...value.filter((x) => x !== exclusive), p.id])
              }
              className={cn(
                "tap inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600",
                on ? CHIP_ON[tone] : "border-navy/10 bg-white text-slate-700 hover:border-navy/30",
              )}
            >
              {on && <Check aria-hidden className="size-3.5" />}
              {p.label}
            </button>
          );
        })}
      </div>
      {writing ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={`${id}-note`} className="text-sm font-semibold text-ink">
              {noteLabel} <span className="font-normal text-slate">(optional)</span>
            </label>
            {!note && (
              <button type="button" onClick={() => setWriting(false)} className="tap grid size-9 place-items-center rounded-full text-slate hover:bg-paper-200" aria-label="Close the comment box">
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
          <textarea
            ref={area}
            id={`${id}-note`}
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => onNote(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-navy/15 p-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-electric-600"
          />
        </div>
      ) : (
        <button type="button" onClick={() => setWriting(true)} className="tap mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-electric-600 hover:bg-paper-200">
          <PencilLine aria-hidden className="size-4" /> Write in your own words
        </button>
      )}
    </div>
  );
}

function Recommend({
  value,
  onChange,
  comments,
  onComments,
  quoteOk,
  onQuoteOk,
}: {
  value: number | null;
  onChange: (v: number) => void;
  comments: string;
  onComments: (v: string) => void;
  quoteOk: boolean;
  onQuoteOk: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-5">
      <div>
        <Question id={id}>How likely are you to recommend INSPIRE to a friend?</Question>
        <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, n) => {
            const on = value === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={`${n}${n === 0 ? ", not at all likely" : n === 10 ? ", extremely likely" : ""}`}
                onClick={() => onChange(n)}
                className={cn(
                  "tap grid min-h-12 place-items-center rounded-lg border-2 font-ui text-sm font-semibold transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600",
                  on ? "scale-110 border-navy bg-navy text-paper shadow-md" : cn("border-transparent text-ink hover:border-navy/30", SCALE_TINT[n]),
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div aria-hidden className="mt-1.5 flex justify-between text-xs text-slate">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-c`} className="text-sm font-semibold text-ink">
          Anything else you&apos;d like to tell us? <span className="font-normal text-slate">(optional)</span>
        </label>
        <textarea
          id={`${id}-c`}
          value={comments}
          maxLength={NOTE_MAX}
          onChange={(e) => onComments(e.target.value)}
          rows={3}
          placeholder="A thank you, an idea, something we missed…"
          className="mt-1.5 w-full rounded-xl border border-navy/15 p-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-electric-600"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-paper-200/70 p-3 text-sm text-slate-700">
        <input type="checkbox" checked={quoteOk} onChange={(e) => onQuoteOk(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-navy)]" />
        <span>
          <span className="font-semibold text-ink">INSPIRE can quote my comments without my name</span>, for example on the website or when asking sponsors to support next year.
        </span>
      </label>
    </div>
  );
}
