"use client";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

const ToastContext = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                role={t.tone === "error" ? "alert" : "status"}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-white/10 bg-navy/95 p-4 text-paper shadow-2xl shadow-midnight/40 backdrop-blur-md"
              >
                <Icon
                  aria-hidden
                  className={
                    t.tone === "success" ? "size-5 shrink-0 text-cyan" : t.tone === "error" ? "size-5 shrink-0 text-[#ff8a96]" : "size-5 shrink-0 text-violet-300"
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-paper/70">{t.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="-m-1 rounded-sm p-1 text-paper/60 hover:text-paper"
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
