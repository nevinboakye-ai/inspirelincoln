"use client";
import { useId } from "react";
import { X } from "lucide-react";
import { SCALE, scaleLabel } from "@/lib/post-conference/feedback";
import { cn } from "@/lib/cn";

/** Colours for the slider, as CSS colours so the track can be filled with them. */
const TONE = {
  sky: "var(--color-sky)",
  teal: "var(--color-teal)",
  plum: "var(--color-plum)",
  gold: "var(--color-gold-600)",
} as const;

/** The colour the score shows in: low scores warm, high scores cool, so a glance reads the answer. */
const VALUE_TINT = ["", "text-coral", "text-coral", "text-gold-700", "text-teal", "text-teal"];

/**
 * A score from 1 to 5 as a slider. It starts unscored, so parts people
 * didn't go to stay blank: slide the thumb, or tap a number, and tap the
 * cross to clear it again.
 */
export function ScoreSlider({
  label,
  sub,
  value,
  onChange,
  tone = "sky",
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  tone?: keyof typeof TONE;
}) {
  const id = useId();
  const set = value !== null;
  return (
    <div className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={`${id}-l`} className="text-sm font-semibold leading-snug text-ink">
            {label}
          </p>
          {sub && <p className="text-xs leading-snug text-slate-700">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <p aria-hidden className={cn("font-ui text-sm font-semibold tabular-nums", set ? VALUE_TINT[value] : "font-normal text-slate")}>
            {set ? (
              <>
                {value}/5 <span className="hidden font-medium sm:inline">· {scaleLabel(value)}</span>
              </>
            ) : (
              "Not rated"
            )}
          </p>
          {set && (
            <button type="button" onClick={() => onChange(null)} className="tap -my-2 grid size-9 place-items-center rounded-full text-slate hover:bg-paper-200" aria-label="Clear this score">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value ?? 3}
        data-unset={set ? undefined : ""}
        aria-labelledby={`${id}-l`}
        aria-valuetext={set ? `${value} out of 5, ${scaleLabel(value)}` : "Not rated yet"}
        onChange={(e) => onChange(Number(e.target.value))}
        // A tap on the track (or on the faint middle thumb) scores it too.
        onClick={(e) => onChange(Number(e.currentTarget.value))}
        className="score-slider mt-1 block"
        style={{ "--fill": set ? `${((value - 1) / 4) * 100}%` : "0%", "--tone": TONE[tone] } as React.CSSProperties}
      />
      <div aria-hidden className="-mt-1 flex justify-between px-[0.1875rem]">
        {SCALE.map((s) => (
          <button
            key={s.value}
            type="button"
            tabIndex={-1}
            onClick={() => onChange(s.value)}
            className={cn(
              "grid h-7 w-6 place-items-center rounded-md font-ui text-xs font-semibold transition-colors",
              value === s.value ? "text-ink" : "text-slate hover:text-ink",
            )}
          >
            {s.value}
          </button>
        ))}
      </div>
    </div>
  );
}
