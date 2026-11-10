"use client";
import Link from "next/link";
import { ArrowRight, CalendarClock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Opportunity } from "@/lib/types";
import { PlaceholderTag } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export const OPPORTUNITY_CATEGORIES = [
  "Research opportunities",
  "Academic mentorship",
  "Workshops and masterclasses",
  "Student research collaborations",
  "Conferences and presentation opportunities",
  "Educational resources",
];

export function OpportunityHub({ items }: { items: Opportunity[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(
    () =>
      items.filter(
        (o) =>
          (!cat || o.category === cat) &&
          (!openOnly || !o.deadline || o.deadline >= today) &&
          (!q || `${o.title} ${o.summary} ${o.organisation ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [items, cat, openOnly, q, today],
  );

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <aside className="lg:col-span-3">
        <div className="space-y-6 lg:sticky lg:top-28">
          <label className="relative block">
            <span className="sr-only">Search opportunities</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-11 w-full rounded-full border border-navy/15 bg-white pl-11 pr-4 text-ink placeholder:text-slate" />
          </label>
          <fieldset>
            <legend className="eyebrow mb-3 text-slate">Category</legend>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {["", ...OPPORTUNITY_CATEGORIES].map((c) => (
                <button key={c || "all"} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn("min-h-10 rounded-full px-4 text-left text-sm font-medium transition-colors lg:rounded-md", cat === c ? "bg-navy text-paper" : "bg-white text-slate-700 hover:bg-paper-200")}>
                  {c || "All categories"}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="size-5 accent-electric-600" />
            Hide past deadlines
          </label>
        </div>
      </aside>
      <div className="lg:col-span-9">
        <p aria-live="polite" className="mb-4 text-sm text-slate">{filtered.length} opportunit{filtered.length === 1 ? "y" : "ies"}</p>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-navy/20 bg-white px-6 py-16 text-center">
            <h2 className="font-display text-2xl font-semibold text-ink">No opportunities listed yet</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-700">
              The INSPIRE team will publish research, mentorship and learning opportunities here as they become available. Have one to
              share?{" "}
              <Link href="/contact?category=partnerships" className="font-medium text-electric-600 underline underline-offset-4">
                Get in touch
              </Link>
              .
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-navy/20 bg-white p-10 text-center text-slate-700">Nothing matches those filters.</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((o) => (
              <li key={o.id}>
                <Link href={`/opportunities/${o.slug}`} className="group grid gap-4 rounded-lg border border-navy/10 bg-white p-6 transition-colors hover:border-electric-600/40 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-electric-600">{o.category}</span>
                      {o.isExample && <PlaceholderTag>Example</PlaceholderTag>}
                    </span>
                    <span className="mt-2 block font-display text-xl font-medium text-ink">{o.title}</span>
                    {o.organisation && <span className="block text-sm text-slate">{o.organisation}</span>}
                    <span className="mt-2 block text-slate-700">{o.summary}</span>
                  </span>
                  <span className="flex items-center gap-4 text-sm text-slate">
                    {o.deadline && (
                      <span className="flex items-center gap-1.5">
                        <CalendarClock aria-hidden className="size-4" />
                        {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${o.deadline}T12:00:00Z`))}
                      </span>
                    )}
                    <ArrowRight aria-hidden className="size-5 text-electric-600 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
