"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, FlaskConical, Loader2, Lock, MessageCircle, PencilLine, Star, X } from "lucide-react";
import { submitFeedback } from "@/app/portal/after/actions";
import { HIGHLIGHTS, IMPROVEMENTS, IMPROVE_NOTHING, MAX_WORKSHOPS, NOTE_MAX, OVERALL, RESEARCH_INTEREST, partScore, partsFor, type FeedbackWorkshop as FormWorkshop, type Phrase, type ResearchInterest } from "@/lib/post-conference/feedback";
import { ScoreSlider } from "@/components/post-conference/score-slider";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

type WorkshopDraft = { id: string; workshop: number | null; lead: number | null; note: string };
type Draft = {
  overall: number | null;
  parts: Record<string, number>;
  workshops: WorkshopDraft[];
  highlights: string[];
  highlightNote: string;
  improvements: string[];
  improveNote: string;
  recommend: number | null;
  comments: string;
  quoteOk: boolean;
  research: ResearchInterest | null;
  researchContact: boolean;
};
const EMPTY: Draft = {
  overall: null,
  parts: {},
  workshops: [],
  highlights: [],
  highlightNote: "",
  improvements: [],
  improveNote: "",
  recommend: null,
  comments: "",
  quoteOk: false,
  research: null,
  researchContact: true,
};

/** A saved draft, tidied: older drafts held great / OK / poor, and workshops may have changed since. */
function restore(raw: string, workshops: FormWorkshop[], start: Draft): Draft {
  const saved = JSON.parse(raw) as Partial<Draft> & { parts?: Record<string, unknown> };
  const parts = Object.fromEntries(
    Object.entries(saved.parts ?? {}).flatMap(([k, v]) => {
      const n = partScore(v);
      return n === null ? [] : [[k, n]];
    }),
  );
  const known = new Set(workshops.map((w) => w.id));
  const ws = Array.isArray(saved.workshops) ? saved.workshops.filter((w) => w && known.has(w.id)) : start.workshops;
  return { ...start, ...saved, parts, workshops: ws };
}

const STEPS = ["overall", "parts", "workshops", "highlights", "improvements", "recommend", "research"] as const;
type Step = (typeof STEPS)[number];
const STEP_TONE: Record<Step, { chip: string; bar: string; card: string }> = {
  overall: { chip: "bg-gold/20 text-gold-700", bar: "bg-gold", card: "border-t-gold" },
  parts: { chip: "bg-sky-100 text-sky", bar: "bg-sky", card: "border-t-sky" },
  workshops: { chip: "bg-plum-100 text-plum", bar: "bg-plum", card: "border-t-plum" },
  highlights: { chip: "bg-teal-100 text-teal", bar: "bg-teal", card: "border-t-teal" },
  improvements: { chip: "bg-coral-100 text-coral", bar: "bg-coral", card: "border-t-coral" },
  recommend: { chip: "bg-cyan-300 text-electric-600", bar: "bg-electric", card: "border-t-electric" },
  research: { chip: "bg-gold/20 text-gold-700", bar: "bg-navy", card: "border-t-navy" },
};
const STEP_LABEL: Record<Step, string> = {
  overall: "The day",
  parts: "Each part",
  workshops: "Your workshop",
  highlights: "Best bits",
  improvements: "Next year",
  recommend: "Almost done",
  research: "Last one",
};

/** 0 to 10 tinted from cool to warm, matching the research questionnaires. */
const SCALE_TINT = ["bg-rose-100", "bg-rose-100/80", "bg-coral-100", "bg-coral-100/80", "bg-gold/15", "bg-gold/20", "bg-gold/25", "bg-teal-100/70", "bg-teal-100", "bg-sky-100", "bg-sky-100/90"];

const DRAFT_KEY = "inspire-feedback-draft";

/**
 * The post-conference feedback, one short screen at a time: a star rating
 * (one tap moves on), optional 1 to 5 sliders for each part of the day, the
 * workshop they went to (the workshop and the doctor who led it), tap-to-pick
 * phrases for the best bits and what to change (each with room to write
 * more), 0 to 10 for recommending INSPIRE, and whether they'd like help with
 * their own research. Answers are kept on this device until sent, so closing
 * the tab loses nothing.
 */
export function FeedbackForm({
  presenter,
  workshops = [],
  myWorkshops = [],
  preview = false,
}: {
  presenter: boolean;
  /** This year's workshops, to say which one they went to. */
  workshops?: FormWorkshop[];
  /** The workshops they had a place in, ticked to start with. */
  myWorkshops?: string[];
  preview?: boolean;
}) {
  const router = useRouter();
  const initial = useMemo<Draft>(
    () => ({ ...EMPTY, workshops: myWorkshops.slice(0, MAX_WORKSHOPS).map((id) => ({ id, workshop: null, lead: null, note: "" })) }),
    [myWorkshops],
  );
  const steps = useMemo(() => STEPS.filter((s) => s !== "workshops" || workshops.length > 0), [workshops.length]);
  const [d, setD] = useState<Draft>(initial);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [saving, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const step = steps[at];
  const last = at === steps.length - 1;
  const tone = STEP_TONE[step];

  useEffect(() => {
    if (preview) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read once after hydration
      if (raw) setD(restore(raw, workshops, initial));
    } catch {}
    // Read the saved draft once, when the form first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      go(steps.indexOf("recommend"));
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
        workshops: d.workshops.map((w) => ({ id: w.id, workshop: w.workshop, lead: w.lead, note: w.note })),
        research: d.research,
        researchContact: d.researchContact,
      });
      if (!r.ok) {
        if (r.step === "overall") go(0);
        if (r.step === "recommend") go(steps.indexOf("recommend"));
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
    if (step === "recommend" && d.recommend === null) {
      setFlagged(true);
      return setError("Choose a number from 0 to 10.");
    }
    if (last) return send();
    go(at + 1);
  };

  const optionalEmpty =
    (step === "parts" && !Object.keys(d.parts).length) ||
    (step === "workshops" && !d.workshops.length) ||
    (step === "highlights" && !d.highlights.length && !d.highlightNote.trim()) ||
    (step === "improvements" && !d.improvements.length && !d.improveNote.trim());
  const pct = Math.round(((at + (step === "overall" ? (d.overall ? 1 : 0) : 1)) / steps.length) * 100);
  const showButton = step !== "overall" || d.overall !== null;

  return (
    <div ref={top} tabIndex={-1} className="space-y-3 outline-none">
      <div className="app-card px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-ui text-sm font-semibold text-ink">
            Your feedback <span className="font-normal text-slate">· {at + 1} of {steps.length}</span>
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
          {step === "workshops" && <Workshops list={workshops} mine={myWorkshops} value={d.workshops} onChange={(ws) => update({ workshops: ws })} />}
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
          {step === "research" && (
            <Research
              value={d.research}
              onChange={(research) => update({ research, researchContact: research === "no" ? false : d.research === "no" || d.research === null ? true : d.researchContact })}
              contact={d.researchContact}
              onContact={(researchContact) => update({ researchContact })}
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

function Parts({ presenter, value, onChange }: { presenter: boolean; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  const id = useId();
  return (
    <div>
      <Question id={id} hint="Slide or tap a number, from 1 (poor) to 5 (excellent). Leave out anything you missed.">
        How was each part of the day?
      </Question>
      <ul role="group" aria-labelledby={id} className="divide-y divide-navy/[0.07]">
        {partsFor(presenter).map((p) => (
          <li key={p.id}>
            <ScoreSlider
              label={p.label}
              value={value[p.id] ?? null}
              onChange={(v) => {
                const nextVal = { ...value };
                if (v === null) delete nextVal[p.id];
                else nextVal[p.id] = v;
                onChange(nextVal);
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Workshops({ list, mine, value, onChange }: { list: FormWorkshop[]; mine: string[]; value: WorkshopDraft[]; onChange: (v: WorkshopDraft[]) => void }) {
  const id = useId();
  const picked = new Set(value.map((w) => w.id));
  const toggle = (wid: string) =>
    onChange(picked.has(wid) ? value.filter((w) => w.id !== wid) : [...value, { id: wid, workshop: null, lead: null, note: "" }].slice(0, MAX_WORKSHOPS));
  const patch = (wid: string, p: Partial<WorkshopDraft>) => onChange(value.map((w) => (w.id === wid ? { ...w, ...p } : w)));
  const chosen = list.filter((w) => picked.has(w.id));
  return (
    <div>
      <Question id={id} hint={mine.length ? "We've ticked the one you had a place in. Change it if you went to a different one." : "Tap the one you went to, or skip if you didn't go to one."}>
        Which workshop did you go to?
      </Question>
      <div role="group" aria-labelledby={id} className="grid gap-2">
        {list.map((w) => {
          const on = picked.has(w.id);
          return (
            <button
              key={w.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(w.id)}
              className={cn(
                "tap flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600",
                on ? "border-plum bg-plum-100/60" : "border-navy/10 bg-white hover:border-navy/30",
              )}
            >
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full font-ui text-xs font-bold", on ? "bg-plum text-white" : "bg-paper-200 text-slate-700")}>
                {on ? <Check aria-hidden className="size-4" /> : w.number}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-ink">{w.title}</span>
                {w.facilitator && <span className="block text-xs text-slate-700">Led by {w.facilitator}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {chosen.map((w) => {
        const a = value.find((x) => x.id === w.id)!;
        return (
          <section key={w.id} aria-label={`Your scores for ${w.title}`} className="mt-4 rounded-2xl bg-plum-100/40 p-3 ring-1 ring-plum/15 sm:p-4">
            <p className="font-ui text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-plum">Workshop {w.number}</p>
            <p className="font-display text-lg leading-tight text-ink">{w.title}</p>
            <div className="mt-1 divide-y divide-plum/10">
              <ScoreSlider tone="plum" label="The workshop" sub="What you did and learned" value={a.workshop} onChange={(v) => patch(w.id, { workshop: v })} />
              <ScoreSlider
                tone="plum"
                label={w.facilitator ?? "The doctor who led it"}
                sub={w.facilitator ? "Who led it: their teaching and how they ran it" : "Their teaching and how they ran it"}
                value={a.lead}
                onChange={(v) => patch(w.id, { lead: v })}
              />
            </div>
            <WorkshopNote value={a.note} onChange={(note) => patch(w.id, { note })} />
          </section>
        );
      })}
    </div>
  );
}

function WorkshopNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(Boolean(value));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="tap mt-1 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-semibold text-electric-600 hover:bg-white/60">
        <PencilLine aria-hidden className="size-4" /> Add a comment for the workshop or its lead
      </button>
    );
  return (
    <div className="mt-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        Your comment <span className="font-normal text-slate">(optional)</span>
      </label>
      <textarea
        id={id}
        value={value}
        autoFocus={!value}
        maxLength={NOTE_MAX}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="What worked, what could be better…"
        className="mt-1.5 w-full rounded-xl border border-navy/15 bg-white p-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-electric-600"
      />
    </div>
  );
}

function Research({
  value,
  onChange,
  contact,
  onContact,
}: {
  value: ResearchInterest | null;
  onChange: (v: ResearchInterest | null) => void;
  contact: boolean;
  onContact: (v: boolean) => void;
}) {
  const id = useId();
  const keen = value === "yes" || value === "maybe";
  return (
    <div>
      <div className="mb-3 flex items-start gap-3">
        <span className="icon-chip-sm shrink-0 bg-gold/20 text-gold-700">
          <FlaskConical aria-hidden className="size-4" />
        </span>
        <Question id={id} hint="INSPIRE helps students start their own projects, from a first idea to a poster or paper.">
          Would you like to do your own research with INSPIRE&apos;s support?
        </Question>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-cols-3">
        {RESEARCH_INTEREST.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : o.value)}
              className={cn(
                "tap min-h-12 rounded-xl border-2 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600",
                on ? "border-navy bg-navy text-paper shadow-md" : "border-navy/10 bg-white text-ink hover:border-navy/30",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {keen && (
        <div className="pop-in mt-4 rounded-2xl bg-midnight p-4 text-paper">
          <p className="font-display text-lg leading-tight">Brilliant. Here&apos;s how to start.</p>
          <ol className="mt-2 space-y-1.5 text-sm text-paper/80">
            <li className="flex gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-gold font-ui text-[0.7rem] font-bold text-midnight">1</span>
              Take part in the INSPIRE research study, so you see how a real study runs.
            </li>
            <li className="flex gap-2">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-gold font-ui text-[0.7rem] font-bold text-midnight">2</span>
              Get in touch with us, and we&apos;ll help you turn an idea into a project.
            </li>
          </ol>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-paper/65">
            <MessageCircle aria-hidden className="size-3.5" /> Both links are waiting in your hub once you send this.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-white/10 p-3 text-sm ring-1 ring-white/15">
            <input type="checkbox" checked={contact} onChange={(e) => onContact(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-gold)]" />
            <span>
              <span className="font-semibold">Ask the committee to get in touch with me</span>
              <span className="block text-paper/70">This shares your name with them, kept apart from your feedback, which stays without your name.</span>
            </span>
          </label>
        </div>
      )}
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
