"use client";
import { Check, Copy, SmilePlus } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { REACTION_EMOJI, REACTION_LABEL, groupReactions, whoReacted, type Reaction, type ReactionEmoji } from "@/lib/reactions";

const HOLD_MS = 420;

/**
 * A message bubble people can react to. On a laptop a smiley button
 * appears beside the bubble on hover or keyboard focus; on a phone you
 * press and hold the bubble. Reactions show as small chips under it, and
 * tapping a chip adds or takes back your own.
 */
export function Reactable({
  children,
  reactions,
  me,
  own,
  enabled,
  onToggle,
  nameOf,
  copyText,
}: {
  children: ReactNode;
  reactions: readonly Reaction[];
  me: string;
  /** My own message: sits on the right, so the button and picker go on its left. */
  own: boolean;
  /** Whether I can react here. Existing reactions show either way. */
  enabled: boolean;
  onToggle: (emoji: ReactionEmoji, on: boolean) => void;
  nameOf: (r: Reaction) => string;
  /** The message text, for the Copy button in the picker. */
  copyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const held = useRef(false);
  const pickerId = useId();
  const groups = groupReactions(reactions, me);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setCopied(false);
    if (refocus) trigger.current?.focus({ preventScroll: true });
  }, []);

  // Close on a tap elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);

  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (!enabled || e.pointerType === "mouse") return;
    held.current = false;
    const timer = window.setTimeout(() => {
      held.current = true;
      hold.current = null;
      navigator.vibrate?.(10);
      setOpen(true);
    }, HOLD_MS);
    hold.current = { timer, x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: PointerEvent) => {
    if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) cancelHold();
  };

  const pick = (emoji: ReactionEmoji) => {
    const mine = groups.find((g) => g.emoji === emoji)?.mine ?? false;
    onToggle(emoji, !mine);
    close(true);
  };

  const copy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => close(), 700);
    } catch {
      close();
    }
  };

  return (
    <div ref={wrap} className={cn("relative flex max-w-full flex-col", own ? "items-end" : "items-start")}>
      <div className={cn("group/react flex max-w-full items-center gap-1", own && "flex-row-reverse")}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => {
            // A long press on a phone opens the picker instead of the system menu.
            if (enabled && (held.current || hold.current)) e.preventDefault();
          }}
          className={cn("min-w-0 max-w-full", enabled && "[-webkit-touch-callout:none] pointer-coarse:select-none")}
        >
          {children}
        </div>
        {enabled && (
          <button
            ref={trigger}
            type="button"
            aria-label="React to this message"
            aria-expanded={open}
            aria-controls={open ? pickerId : undefined}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-slate transition-opacity hover:bg-white hover:text-ink focus-visible:opacity-100",
              open ? "opacity-100" : "opacity-0 group-hover/react:opacity-100 pointer-coarse:sr-only",
            )}
          >
            <SmilePlus aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          id={pickerId}
          role="group"
          aria-label="Choose a reaction"
          className={cn(
            "absolute bottom-full z-20 mb-1 flex max-w-[calc(100vw-3.5rem)] items-center overflow-x-auto rounded-full border border-navy/10 bg-white p-1 shadow-[0_16px_40px_-18px_rgba(12,24,44,0.5)] [scrollbar-width:none] motion-safe:animate-[dm-in_160ms_var(--ease-out-expo)]",
            own ? "right-0" : "left-0",
          )}
        >
          {REACTION_EMOJI.map((e, i) => {
            const mine = groups.find((g) => g.emoji === e)?.mine ?? false;
            return (
              <button
                key={e}
                type="button"
                autoFocus={i === 0}
                aria-label={`${mine ? "Take back" : "React with"} ${REACTION_LABEL[e]}`}
                aria-pressed={mine}
                onClick={() => pick(e)}
                className={cn(
                  "grid size-[2.125rem] shrink-0 place-items-center rounded-full text-[1.2rem] leading-none sm:size-10 sm:text-[1.35rem] transition-transform hover:scale-110 hover:bg-paper focus-visible:outline-2 focus-visible:outline-electric-600 active:scale-95",
                  mine && "bg-cyan-300/80",
                )}
              >
                {e}
              </button>
            );
          })}
          {copyText && (
            <>
              <span aria-hidden className="h-6 w-px shrink-0 bg-navy/10" />
              <button
                type="button"
                aria-label={copied ? "Copied" : "Copy message"}
                onClick={() => void copy()}
                className="grid size-[2.125rem] shrink-0 place-items-center rounded-full text-slate-700 hover:bg-paper sm:size-10 focus-visible:outline-2 focus-visible:outline-electric-600"
              >
                {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
              </button>
            </>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <ul aria-label="Reactions" className={cn("relative z-[1] -mt-1.5 flex flex-wrap gap-1 px-2", own ? "justify-end" : "justify-start")}>
          {groups.map((g) => {
            const who = whoReacted(g.people, me, nameOf);
            return (
              <li key={g.emoji}>
                <button
                  type="button"
                  disabled={!enabled}
                  title={who}
                  aria-label={`${REACTION_LABEL[g.emoji]}, ${who}${enabled ? (g.mine ? ". Tap to take yours back" : ". Tap to add yours") : ""}`}
                  aria-pressed={enabled ? g.mine : undefined}
                  onClick={() => onToggle(g.emoji, !g.mine)}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs font-semibold tabular-nums shadow-sm transition-colors disabled:cursor-default",
                    g.mine ? "border-electric-600/40 bg-cyan-300 text-navy" : "border-navy/10 bg-white text-slate-700 enabled:hover:bg-paper",
                  )}
                >
                  <span aria-hidden className="text-[0.85rem] leading-none">
                    {g.emoji}
                  </span>
                  {g.count > 1 && <span aria-hidden>{g.count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
