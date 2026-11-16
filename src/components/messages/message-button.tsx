"use client";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { startConversation } from "@/app/portal/message-actions";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast";
import { viewingAs } from "@/lib/view-as-client";

const STYLES = {
  solid: "bg-navy text-paper hover:bg-navy-700",
  gold: "bg-gold text-midnight hover:bg-gold-300",
  outline: "border border-navy/15 bg-white text-ink hover:border-navy/35",
  dark: "bg-white/10 text-paper ring-1 ring-white/20 hover:bg-white/15",
} as const;

/** The round, icon-only version sits on a card, so it needs its own look on light and dark cards. */
const ICON_STYLES = {
  solid: "bg-navy text-paper hover:bg-navy-700",
  gold: "bg-gold text-midnight hover:bg-gold-300",
  outline: "bg-white text-navy ring-1 ring-navy/15 hover:bg-navy hover:text-paper hover:ring-navy",
  dark: "bg-midnight text-gold-300 ring-1 ring-gold/40 hover:bg-midnight/85",
} as const;

/**
 * "Message" button for anywhere a person is shown: opens (or starts) your
 * conversation with them in My Hub. The database decides whether you're
 * allowed, and any reason it gives is shown under the button.
 *
 * Usage: <MessageButton personId={id} name={fullName} />
 *
 * `icon` gives a small round button with no text, for cards. It says why it
 * couldn't open the conversation in a toast, as there's no room underneath.
 */
export function MessageButton({
  personId,
  name,
  variant = "solid",
  label = "Message",
  className,
  icon = false,
}: {
  personId: string;
  name?: string | null;
  variant?: keyof typeof STYLES;
  label?: string;
  className?: string;
  icon?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = () =>
    start(async () => {
      setError(null);
      const res = await startConversation(personId);
      if (!res.ok) {
        const reason = viewingAs() ? "You're viewing as someone else, so messages are read only." : res.error;
        if (icon) toast({ tone: "error", title: "Couldn't open messages", body: reason });
        else setError(reason);
        return;
      }
      router.push(`/portal/messages/${res.id}`);
    });
  if (icon) {
    const full = name ? `${label} ${name}` : label;
    return (
      <button
        type="button"
        onClick={open}
        disabled={pending}
        aria-label={full}
        title={full}
        className={cn(
          "inline-flex size-9 items-center sm:size-10 justify-center rounded-full shadow-[0_6px_16px_-8px_rgba(12,24,44,0.55)] transition-[transform,background-color,color] duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600 disabled:opacity-70 motion-reduce:transition-none motion-reduce:hover:scale-100",
          ICON_STYLES[variant],
          className,
        )}
      >
        {pending ? <Loader2 aria-hidden className="size-[1.1rem] animate-spin" /> : <MessageCircle aria-hidden className="size-[1.1rem]" />}
      </button>
    );
  }
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-[3px] px-4 text-sm font-semibold transition-colors disabled:opacity-70", STYLES[variant])}
      >
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <MessageCircle aria-hidden className="size-4" />}
        {label}
        {name && <span className="sr-only"> {name}</span>}
      </button>
      {error && (
        <span role="alert" className={cn("mt-1.5 max-w-xs text-xs font-medium", variant === "dark" ? "text-gold-300" : "text-danger")}>
          {error}
        </span>
      )}
    </span>
  );
}
