"use client";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CornerDownLeft, MessageCircleQuestion, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { searchItems, type QuickAnswer, type SearchIndex, type SearchItem } from "@/lib/search/types";
import { cn } from "@/lib/cn";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("inspire:search"));
}

/**
 * Global search (⌘K / Ctrl+K / "/") across pages, sessions, speakers, workshops,
 * resources and FAQs, plus a guided "quick answers" finder. This is keyword
 * search over site content; it is not an AI assistant.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  const [answer, setAnswer] = useState<QuickAnswer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const listId = useId();

  const load = useCallback(async () => {
    if (index) return;
    try {
      const res = await fetch("/search-index");
      if (!res.ok) throw new Error(String(res.status));
      setIndex(await res.json());
    } catch {
      setError(true);
    }
  }, [index]);

  const show = useCallback(() => {
    restoreFocus.current = document.activeElement as HTMLElement;
    setOpen(true);
    void load();
  }, [load]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setAnswer(null);
    setActive(0);
    requestAnimationFrame(() => restoreFocus.current?.focus?.());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        if (open) close();
        else show();
      }
    };
    const onOpen = () => show();
    window.addEventListener("keydown", onKey);
    window.addEventListener("inspire:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("inspire:search", onOpen);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (open) {
      document.documentElement.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      document.documentElement.style.overflow = "";
    }
  }, [open]);

  const results = useMemo<SearchItem[]>(() => (index && query ? searchItems(index.items, query) : []), [index, query]);
  const answers = useMemo(() => {
    if (!index) return [];
    if (!query) return index.answers;
    const q = query.toLowerCase();
    return index.answers.filter((a) => a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q)).slice(0, 2);
  }, [index, query]);

  type Option = { type: "answer"; a: QuickAnswer } | { type: "item"; item: SearchItem };
  const options: Option[] = useMemo(
    () => [...answers.map((a) => ({ type: "answer" as const, a })), ...results.map((item) => ({ type: "item" as const, item }))],
    [answers, results],
  );

  useEffect(() => setActive(0), [query]);

  const choose = (opt: Option) => {
    if (opt.type === "answer") {
      setAnswer(opt.a);
      return;
    }
    close();
    if (/^https?:\/\//.test(opt.item.href)) window.open(opt.item.href, "_blank", "noopener");
    else router.push(opt.item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (answer) setAnswer(null);
      else close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Tab") {
      // Keep focus inside the dialog.
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-midnight/70 backdrop-blur-sm" onClick={close} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search INSPIRE"
            onKeyDown={onKeyDown}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-navy text-paper shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5">
              <Search aria-hidden className="size-5 text-cyan" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setAnswer(null);
                }}
                role="combobox"
                aria-expanded={options.length > 0}
                aria-controls={listId}
                aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                placeholder="Search sessions, speakers, workshops, guidance…"
                className="h-16 w-full bg-transparent text-lg text-paper placeholder:text-paper/40 focus:outline-none"
              />
              <button type="button" onClick={close} className="rounded-sm p-2 text-paper/60 hover:text-paper" aria-label="Close search">
                <X className="size-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              {answer ? (
                <div className="p-4" aria-live="polite">
                  <p className="eyebrow mb-3 text-cyan">Quick answer</p>
                  <p className="font-display text-xl font-medium">{answer.question}</p>
                  <p className="mt-3 leading-relaxed text-paper/75">{answer.answer}</p>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      router.push(answer.href);
                    }}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-cyan px-5 py-2.5 text-sm font-semibold text-midnight"
                  >
                    {answer.linkLabel} <ArrowRight className="size-4" />
                  </button>
                  <button type="button" onClick={() => setAnswer(null)} className="ml-3 text-sm text-paper/60 underline underline-offset-4 hover:text-paper">
                    Back
                  </button>
                </div>
              ) : (
                <ul id={listId} role="listbox" aria-label="Search results">
                  {!index && !error && <li className="p-6 text-center text-sm text-paper/50">Loading…</li>}
                  {error && <li className="p-6 text-center text-sm text-paper/60">Search is unavailable right now.</li>}
                  {index && !query && (
                    <li role="presentation" className="eyebrow px-3 pb-2 pt-3 text-paper/45">
                      Common questions
                    </li>
                  )}
                  {options.map((opt, i) => {
                    const isActive = i === active;
                    const firstItem = opt.type === "item" && (i === 0 || options[i - 1].type === "answer");
                    return (
                      <li key={opt.type === "answer" ? `a-${opt.a.id}` : opt.item.id} role="presentation">
                        {firstItem && query && answers.length > 0 && (
                          <p role="presentation" className="eyebrow px-3 pb-2 pt-4 text-paper/45">
                            Results
                          </p>
                        )}
                        <div
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={isActive}
                          onMouseMove={() => setActive(i)}
                          onClick={() => choose(opt)}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-sm px-3 py-3 transition-colors",
                            isActive ? "bg-white/[0.07]" : "",
                          )}
                        >
                          {opt.type === "answer" ? (
                            <>
                              <MessageCircleQuestion aria-hidden className="size-4 shrink-0 text-violet-300" />
                              <span className="flex-1 text-[0.95rem]">{opt.a.question}</span>
                            </>
                          ) : (
                            <>
                              <span className="w-24 shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan/80">
                                {opt.item.kind}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.95rem]">{opt.item.title}</span>
                                {opt.item.summary && <span className="block truncate text-sm text-paper/50">{opt.item.summary}</span>}
                              </span>
                            </>
                          )}
                          {isActive && <CornerDownLeft aria-hidden className="size-4 shrink-0 text-paper/40" />}
                        </div>
                      </li>
                    );
                  })}
                  {index && query && options.length === 0 && (
                    <li className="p-8 text-center text-sm text-paper/60">
                      No matches for “{query}”. Try a broader term, or{" "}
                      <button
                        type="button"
                        className="text-cyan underline underline-offset-4"
                        onClick={() => {
                          close();
                          router.push("/contact");
                        }}
                      >
                        ask the team
                      </button>
                      .
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div className="hidden items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-paper/45 sm:flex">
              <span>
                <kbd className="rounded-xs border border-white/15 px-1.5 py-0.5">↑</kbd>{" "}
                <kbd className="rounded-xs border border-white/15 px-1.5 py-0.5">↓</kbd> to move,{" "}
                <kbd className="rounded-xs border border-white/15 px-1.5 py-0.5">Enter</kbd> to open
              </span>
              <span>Keyword search across the site</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
