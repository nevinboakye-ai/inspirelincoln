"use client";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { startConversation } from "@/app/portal/message-actions";
import { cn } from "@/lib/cn";
import { viewingAs } from "@/lib/view-as-client";

const STYLES = {
  solid: "bg-navy text-paper hover:bg-navy-700",
  gold: "bg-gold text-midnight hover:bg-gold-300",
  outline: "border border-navy/15 bg-white text-ink hover:border-navy/35",
  dark: "bg-white/10 text-paper ring-1 ring-white/20 hover:bg-white/15",
} as const;

/**
 * "Message" button for anywhere a person is shown: opens (or starts) your
 * conversation with them in My Hub. The database decides whether you're
 * allowed, and any reason it gives is shown under the button.
 *
 * Usage: <MessageButton personId={id} name={fullName} />
 */
export function MessageButton({
  personId,
  name,
  variant = "solid",
  label = "Message",
  className,
}: {
  personId: string;
  name?: string | null;
  variant?: keyof typeof STYLES;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = () =>
    start(async () => {
      setError(null);
      const res = await startConversation(personId);
      if (!res.ok) {
        setError(viewingAs() ? "You're viewing as someone else, so messages are read only." : res.error);
        return;
      }
      router.push(`/portal/messages/${res.id}`);
    });
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
