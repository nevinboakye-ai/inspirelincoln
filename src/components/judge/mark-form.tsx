"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, CloudOff, Loader2, Lock, MessageSquareQuote, PencilLine, Send, Sparkles, Target } from "lucide-react";
import { saveMark } from "@/app/judge/actions";
import { cn } from "@/lib/cn";
import type { Criterion, JudgingKind } from "@/lib/judging";

type Initial = {
  scores: Record<string, number>;
  strengths: string;
  improvements: string;
  note: string;
  status: "draft" | "submitted" | null;
  updatedAt: string | null;
};

type Draft = { scores: Record<string, number>; strengths: string; improvements: string; note: string; at: number };

const storeKey = (p: string, k: string) => `judge-mark:${p}:${k}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/** Score buttons for one criterion: big enough to tap while standing. */
function ScoreRow({ c, value, onPick, disabled, error }: { c: Criterion; value: number | undefined; onPick: (n: number) => void; disabled: boolean; error: boolean }) {
  const [open, setOpen] = useState(false);
  const options = c.maxScore <= 10 ? Array.from({ length: c.maxScore }, (_, i) => i + 1) : null;
  const cols = c.maxScore <= 5 ? "grid-cols-5" : c.maxScore <= 10 ? "grid-cols-5" : "";
  return (
    <fieldset
      id={`crit-${c.id}`}
      className={cn("scroll-mt-40 rounded-2xl border bg-white p-4 transition-colors", error ? "border-danger/50 ring-2 ring-danger/15" : value !== undefined ? "border-navy/15" : "border-navy/10")}
    >
      <legend className="sr-only">{c.label}, out of {c.maxScore}</legend>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 text-left" aria-expanded={open}>
          <span className="flex items-center gap-1.5 font-semibold text-ink">
            {c.label}
            {c.description && <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-slate transition-transform", open && "rotate-180")} />}
          </span>
          {c.description && <span className={cn("mt-1 block text-sm leading-snug text-slate-700", !open && "line-clamp-1")}>{c.description}</span>}
        </button>
        <span className={cn("shrink-0 rounded-lg px-2.5 py-1 font-display text-lg leading-none", value !== undefined ? "bg-navy text-paper" : "bg-paper-200 text-slate")} aria-hidden>
          {value ?? "–"}
          <span className="text-xs opacity-70">/{c.maxScore}</span>
        </span>
      </div>
      {options ? (
        <div className={cn("mt-3 grid gap-1.5", cols)} role="radiogroup" aria-label={`${c.label}, out of ${c.maxScore}`}>
          {options.map((n) => {
            const on = value === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onPick(n)}
                className={cn(
                  "min-h-12 rounded-xl border font-display text-lg transition-[transform,background-color,color,border-color] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                  on ? "scale-[1.04] border-navy bg-navy text-paper shadow-[0_8px_18px_-10px_rgba(26,49,84,0.9)]" : "border-navy/12 bg-paper text-ink hover:border-navy/40",
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
      ) : (
        <label className="mt-3 flex items-center gap-3">
          <span className="text-sm text-slate-700">Mark</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={c.maxScore}
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (e.target.value !== "" && Number.isInteger(n) && n >= 0 && n <= c.maxScore) onPick(n);
            }}
            className="min-h-12 w-28 rounded-xl border border-navy/15 bg-paper px-3 text-lg text-ink"
          />
          <span className="text-sm text-slate">out of {c.maxScore}</span>
        </label>
      )}
      {error && <p className="mt-2 text-sm font-medium text-danger">Choose a mark.</p>}
    </fieldset>
  );
}

function Feedback({
  id,
  label,
  hint,
  icon: Icon,
  value,
  onChange,
  disabled,
  error,
  tone = "presenter",
  placeholder,
}: {
  id: string;
  label: string;
  hint: string;
  icon: typeof Sparkles;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error?: string;
  tone?: "presenter" | "private";
  placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with the text so nothing scrolls inside a small box on a phone.
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.max(t.scrollHeight, 112)}px`;
  }, [value]);
  return (
    <div id={`fb-${id}`} className={cn("scroll-mt-40 rounded-2xl border p-4", tone === "private" ? "border-dashed border-navy/20 bg-paper" : "border-navy/10 bg-white", error && "border-danger/50 ring-2 ring-danger/15")}>
      <label htmlFor={id} className="flex items-center gap-2 font-semibold text-ink">
        <Icon aria-hidden className={cn("size-4", tone === "private" ? "text-slate" : "text-electric-600")} />
        {label}
      </label>
      <p className="mt-1 text-sm text-slate-700">{hint}</p>
      <textarea
        ref={ref}
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        maxLength={tone === "private" ? 2000 : 3000}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className="mt-3 block w-full resize-none rounded-xl border border-navy/15 bg-white p-3 text-base leading-relaxed text-ink placeholder:text-slate/70 focus:border-navy focus:outline-none focus:ring-4 focus:ring-electric/15 disabled:bg-paper-200/50"
      />
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

/**
 * Marking one presentation. Drafts save themselves as the judge goes (and
 * are kept on the phone too, in case the signal drops); submitting checks
 * every mark and both pieces of feedback are there.
 */
export function MarkForm({
  presenterId,
  kind,
  presenterName,
  criteria,
  initial,
  open,
  canMark,
  next,
}: {
  presenterId: string;
  kind: JudgingKind;
  presenterName: string;
  criteria: Criterion[];
  initial: Initial;
  open: boolean;
  canMark: boolean;
  next: { href: string; name: string; label: string | null } | null;
}) {
  const [scores, setScores] = useState(initial.scores);
  const [strengths, setStrengths] = useState(initial.strengths);
  const [improvements, setImprovements] = useState(initial.improvements);
  const [note, setNote] = useState(initial.note);
  const [status, setStatus] = useState(initial.status);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initial.updatedAt);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const version = useRef(0);

  const locked = !open || !canMark;
  const key = storeKey(presenterId, kind);
  const total = criteria.reduce((a, c) => a + (scores[c.id] ?? 0), 0);
  const max = criteria.reduce((a, c) => a + c.maxScore, 0);
  const scored = criteria.filter((c) => scores[c.id] !== undefined).length;
  const complete = scored === criteria.length && strengths.trim().length > 0 && improvements.trim().length > 0;

  // Bring back anything typed on this phone that didn't reach the server.
  useEffect(() => {
    if (locked) return;
    try {
      const d = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
      const serverAt = initial.updatedAt ? Date.parse(initial.updatedAt) : 0;
      if (d && d.at > serverAt + 1000) {
        setScores(d.scores ?? {});
        setStrengths(d.strengths ?? "");
        setImprovements(d.improvements ?? "");
        setNote(d.note ?? "");
        setDirty(true);
        setRestored(true);
      } else if (d) localStorage.removeItem(key);
    } catch {}
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = useCallback(
    <T,>(set: (v: T) => void) =>
      (v: T) => {
        set(v);
        setDirty(true);
        setError(null);
        version.current += 1;
      },
    [],
  );

  // Keep a copy on the phone as they type.
  useEffect(() => {
    if (!dirty || locked) return;
    try {
      localStorage.setItem(key, JSON.stringify({ scores, strengths, improvements, note, at: Date.now() } satisfies Draft));
    } catch {}
  }, [dirty, locked, key, scores, strengths, improvements, note]);

  const send = useCallback(
    async (submit: boolean) => {
      const v = version.current;
      const res = await saveMark({ presenterId, kind, scores, strengths, improvements, note, submit }).catch(() => null);
      if (!res) {
        setOffline(true);
        return null;
      }
      setOffline(false);
      if (!res.ok) {
        setError(res.error);
        return res;
      }
      setStatus(res.status);
      setSavedAt(res.savedAt);
      if (version.current === v) {
        setDirty(false);
        try {
          localStorage.removeItem(key);
        } catch {}
      }
      return res;
    },
    [presenterId, kind, scores, strengths, improvements, note, key],
  );

  // Drafts save themselves a moment after the judge stops tapping or typing.
  useEffect(() => {
    if (!dirty || locked || status === "submitted") return;
    const t = setTimeout(() => startSave(async () => void (await send(false))), 1400);
    return () => clearTimeout(t);
  }, [dirty, locked, status, send]);

  // Warn before leaving with changes that haven't been saved.
  useEffect(() => {
    if (!dirty || locked) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, locked]);

  const submit = () => {
    const gaps = new Set(criteria.filter((c) => scores[c.id] === undefined).map((c) => `crit-${c.id}`));
    if (!strengths.trim()) gaps.add("fb-strengths");
    if (!improvements.trim()) gaps.add("fb-improvements");
    setMissing(gaps);
    if (gaps.size) {
      const first = [...criteria.map((c) => `crit-${c.id}`), "fb-strengths", "fb-improvements"].find((id) => gaps.has(id));
      if (first) document.getElementById(first)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setError(gaps.size === 1 ? "One thing is still missing." : `${gaps.size} things are still missing.`);
      buzz([60, 50, 60]);
      return;
    }
    startSubmit(async () => {
      const res = await send(true);
      if (res?.ok) {
        setJustSubmitted(true);
        buzz(80);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else buzz([60, 50, 60]);
    });
  };

  const saveState = useMemo(() => {
    if (locked) return { icon: Lock, text: !canMark ? "View only" : "Judging closed", tone: "text-slate" };
    if (offline) return { icon: CloudOff, text: "Offline: kept on this phone", tone: "text-warning" };
    if (saving || submitting) return { icon: Loader2, text: "Saving…", tone: "text-slate", spin: true };
    if (dirty) return { icon: PencilLine, text: status === "submitted" ? "Changes not sent" : "Editing", tone: "text-slate" };
    if (status === "submitted") return { icon: CheckCircle2, text: savedAt ? `Submitted ${time(savedAt)}` : "Submitted", tone: "text-success" };
    if (status === "draft") return { icon: Check, text: savedAt ? `Draft saved ${time(savedAt)}` : "Draft saved", tone: "text-slate" };
    return { icon: PencilLine, text: "Not started", tone: "text-slate" };
  }, [locked, canMark, offline, saving, submitting, dirty, status, savedAt]);

  return (
    <div className="space-y-3">
      {/* Running total, always in view under the site header. */}
      <div className="sticky top-[var(--header-h)] z-30 -mx-4 border-b border-navy/10 bg-paper/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl leading-none text-ink">{total}</span>
              <span className="text-sm text-slate">/ {max}</span>
              <span className="ml-1 truncate text-xs text-slate">
                {scored}/{criteria.length} scored
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy/10">
              <div className="h-full rounded-full bg-gradient-to-r from-electric to-gold transition-[width] duration-500" style={{ width: `${max ? (total / max) * 100 : 0}%` }} />
            </div>
          </div>
          <span className={cn("flex shrink-0 items-center gap-1.5 text-xs font-medium", saveState.tone)} role="status" aria-live="polite">
            <saveState.icon aria-hidden className={cn("size-3.5", saveState.spin && "animate-spin")} />
            {saveState.text}
          </span>
        </div>
      </div>

      {justSubmitted && (
        <section className="enter-pop overflow-hidden rounded-2xl bg-success p-5 text-white" aria-live="polite">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-white/15">
              <CheckCircle2 aria-hidden className="size-6" />
            </span>
            <div>
              <p className="font-display text-xl">Marks submitted</p>
              <p className="text-sm text-white/85">
                {presenterName}: {total}/{max}. You can still change them while judging is open.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {next ? (
              <Link href={next.href} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-success">
                Next: {next.label ? `${next.label} · ` : ""}
                {next.name} <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <p className="flex min-h-12 items-center justify-center rounded-xl bg-white/15 px-4 text-sm font-semibold">That&apos;s everyone on your list!</p>
            )}
            <Link href="/judge" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/40 px-4 text-sm font-semibold">
              Back to the list
            </Link>
          </div>
        </section>
      )}

      {restored && (
        <p className="flex items-start gap-2 rounded-xl border border-electric/20 bg-electric/5 p-3 text-sm text-slate-700">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-electric-600" />
          We brought back changes saved on this phone that hadn&apos;t reached us yet.
        </p>
      )}

      <h2 className="pt-2 font-display text-xl text-ink">Marks</h2>
      {criteria.length === 0 ? (
        <p className="rounded-2xl border border-navy/10 bg-white p-5 text-slate-700">The committee hasn&apos;t set the marking criteria yet.</p>
      ) : (
        criteria.map((c) => (
          <ScoreRow
            key={c.id}
            c={c}
            value={scores[c.id]}
            disabled={locked}
            error={missing.has(`crit-${c.id}`) && scores[c.id] === undefined}
            onPick={(n) => {
              buzz(10);
              change(setScores)({ ...scores, [c.id]: n });
            }}
          />
        ))
      )}

      <h2 className="pt-3 font-display text-xl text-ink">Feedback for {presenterName.split(" ")[0]}</h2>
      <p className="-mt-1 text-sm text-slate-700">The presenter sees this after the conference, when the committee releases feedback. Be specific and kind: it goes into their portfolio.</p>
      <Feedback
        id="strengths"
        label="What went well"
        hint="The strongest parts of the research and how it was presented."
        icon={Sparkles}
        value={strengths}
        onChange={change(setStrengths)}
        disabled={locked}
        error={missing.has("fb-strengths") && !strengths.trim() ? "Write what went well." : undefined}
        placeholder="e.g. A clear research question and a well-chosen design. The results slide was easy to follow…"
      />
      <Feedback
        id="improvements"
        label="What to improve"
        hint="One or two practical next steps they could take."
        icon={Target}
        value={improvements}
        onChange={change(setImprovements)}
        disabled={locked}
        error={missing.has("fb-improvements") && !improvements.trim() ? "Write what to improve." : undefined}
        placeholder="e.g. Say more about the limitations of a single-site sample, and slow down on the methods…"
      />
      <Feedback
        id="note"
        label="Note for the committee (private)"
        hint="Optional. Only the committee sees this, never the presenter. Useful for prize decisions."
        icon={MessageSquareQuote}
        value={note}
        onChange={change(setNote)}
        disabled={locked}
        tone="private"
        placeholder="e.g. Strong contender for best poster."
      />

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.06] p-3 text-sm font-medium text-danger">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {!locked && criteria.length > 0 && (
        <div className="rounded-2xl border border-navy/10 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              {status === "submitted" ? (dirty ? "Send your changes to the committee." : "Submitted. You can change your marks while judging is open.") : complete ? "Everything's filled in." : "Drafts save as you go. Submit when you're done."}
            </p>
            <p className="shrink-0 font-display text-xl text-ink">
              {total}
              <span className="text-sm text-slate">/{max}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || (status === "submitted" && !dirty)}
            className={cn(
              "shine mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-[transform,background-color] active:scale-[0.99] disabled:opacity-60",
              complete ? "bg-navy text-paper" : "bg-navy/85 text-paper",
            )}
          >
            {submitting ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Send aria-hidden className="size-5" />}
            {status === "submitted" ? "Update marks" : "Submit marks"}
          </button>
        </div>
      )}
    </div>
  );
}
