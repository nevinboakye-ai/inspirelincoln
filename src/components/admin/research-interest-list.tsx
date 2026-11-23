"use client";
import { useOptimistic, useState, useTransition } from "react";
import { Check, Mail } from "lucide-react";
import { markResearchContacted } from "@/app/admin/feedback/actions";
import { cn } from "@/lib/cn";

export type InterestRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  institution: string | null;
  year_of_study: string | null;
  asked_at: string;
  contacted_at: string | null;
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" });

/** The people who'd like help starting their own research, with a tick for when someone has been in touch. */
export function ResearchInterestList({ rows }: { rows: InterestRow[] }) {
  const [list, setDone] = useOptimistic(rows, (cur, p: { id: string; done: boolean }) =>
    cur.map((r) => (r.user_id === p.id ? { ...r, contacted_at: p.done ? new Date().toISOString() : null } : r)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!rows.length) return <p className="text-sm text-slate">Nobody yet.</p>;
  const emails = rows.filter((r) => !r.contacted_at).map((r) => r.email);
  return (
    <div>
      <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10">
        {list.map((r) => {
          const done = Boolean(r.contacted_at);
          return (
            <li key={r.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold leading-snug", done ? "text-slate" : "text-ink")}>{r.full_name ?? r.email}</p>
                <p className="truncate text-xs text-slate-700">
                  {[r.institution, r.year_of_study, `asked ${when(r.asked_at)}`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <a href={`mailto:${r.email}?subject=${encodeURIComponent("Your research with INSPIRE")}`} className="tap inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-electric-600 hover:bg-paper-200">
                <Mail aria-hidden className="size-4" /> Email
              </a>
              <button
                type="button"
                aria-pressed={done}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    setDone({ id: r.user_id, done: !done });
                    const res = await markResearchContacted({ userId: r.user_id, contacted: !done });
                    if (!res.ok) setError(res.error ?? "That couldn't be saved.");
                  })
                }
                className={cn(
                  "tap inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1",
                  done ? "bg-success/10 text-success ring-success/25" : "bg-white text-slate-700 ring-navy/15 hover:bg-paper-200",
                )}
              >
                <Check aria-hidden className="size-4" /> {done ? "Contacted" : "Mark contacted"}
              </button>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {emails.length > 1 && (
        <a href={`mailto:?bcc=${emails.join(",")}&subject=${encodeURIComponent("Your research with INSPIRE")}`} className="tap mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-electric-600 hover:bg-paper-200">
          <Mail aria-hidden className="size-4" /> Email everyone not yet contacted ({emails.length})
        </a>
      )}
    </div>
  );
}
