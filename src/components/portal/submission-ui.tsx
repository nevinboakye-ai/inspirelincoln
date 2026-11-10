import { CheckCircle2, MessageSquare, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

export interface FeedbackItem {
  id: string;
  author_name: string;
  decision: string;
  body: string;
  created_at: string;
  version?: number | null;
}

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

const DECISION = {
  comment: { label: "Comment", icon: MessageSquare, tone: "text-slate-700" },
  changes_requested: { label: "Changes requested", icon: RotateCcw, tone: "text-[#7a4a00]" },
  approved: { label: "Approved", icon: CheckCircle2, tone: "text-success" },
} as const;

/** Committee feedback, oldest first, shown to presenters and to the committee. */
export function FeedbackThread({ items, empty }: { items: FeedbackItem[]; empty: string }) {
  if (!items.length) return <p className="text-sm text-slate-700">{empty}</p>;
  return (
    <ol className="space-y-5">
      {items.map((f) => {
        const d = DECISION[f.decision as keyof typeof DECISION] ?? DECISION.comment;
        return (
          <li key={f.id} className="border-l-2 border-navy/15 pl-4">
            <p className={cn("flex items-center gap-2 text-sm font-semibold", d.tone)}>
              <d.icon aria-hidden className="size-4" /> {d.label}
              {f.version != null && <span className="font-normal text-slate">on version {f.version}</span>}
            </p>
            {f.body && <p className="mt-2 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink">{f.body}</p>}
            <p className="mt-2 text-xs text-slate">{f.author_name} · {when(f.created_at)}</p>
          </li>
        );
      })}
    </ol>
  );
}
