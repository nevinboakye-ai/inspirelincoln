"use client";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Speaker } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { SpeakerPortrait } from "./speaker-portrait";

export function SpeakerDirectory({ speakers }: { speakers: Speaker[] }) {
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [type, setType] = useState("");
  const [institution, setInstitution] = useState("");

  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();
  const specialties = uniq(speakers.map((s) => s.specialty));
  const institutions = uniq(speakers.map((s) => s.institution));
  const types = uniq(speakers.map((s) => s.sessionType));

  const filtered = useMemo(
    () =>
      speakers.filter(
        (s) =>
          (!q || s.fullName.toLowerCase().includes(q.toLowerCase())) &&
          (!specialty || s.specialty === specialty) &&
          (!type || s.sessionType === type) &&
          (!institution || s.institution === institution),
      ),
    [speakers, q, specialty, type, institution],
  );

  const select = "h-11 rounded-full border border-navy/15 bg-white px-4 text-sm text-ink disabled:opacity-50";
  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search speakers by name</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="h-11 w-full rounded-full border border-navy/15 bg-white pl-11 pr-4 text-ink placeholder:text-slate" />
        </label>
        <select aria-label="Filter by specialty" className={select} value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={!specialties.length}>
          <option value="">All specialties</option>
          {specialties.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select aria-label="Filter by session type" className={select} value={type} onChange={(e) => setType(e.target.value)} disabled={!types.length}>
          <option value="">All session types</option>
          {types.map((x) => <option key={x} value={x}>{SESSION_CATEGORY_LABEL[x as keyof typeof SESSION_CATEGORY_LABEL]}</option>)}
        </select>
        <select aria-label="Filter by institution" className={select} value={institution} onChange={(e) => setInstitution(e.target.value)} disabled={!institutions.length}>
          <option value="">All institutions</option>
          {institutions.map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      <p aria-live="polite" className="mt-6 text-sm text-slate">{filtered.length} speaker{filtered.length === 1 ? "" : "s"}</p>
      {filtered.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-navy/20 bg-white p-10 text-center text-slate-700">No speakers match those filters.</p>
      ) : (
        <m.ul layout className="mt-6 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence>
            {filtered.map((s) => (
              <m.li key={s.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Link href={`/speakers/${s.slug}`} className="group block">
                  <SpeakerPortrait name={s.fullName} url={s.portraitUrl} className="aspect-[4/5] rounded-lg" />
                  <p className="mt-4 font-display text-xl font-medium text-ink group-hover:text-electric-600">{s.fullName}</p>
                  {s.credentials && <p className="text-sm text-slate">{s.credentials}</p>}
                  <p className="mt-1 text-sm text-slate-700">{[s.position, s.institution].filter(Boolean).join(", ")}</p>
                  {s.specialty && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-electric-600">{s.specialty}</p>}
                </Link>
              </m.li>
            ))}
          </AnimatePresence>
        </m.ul>
      )}
    </div>
  );
}
