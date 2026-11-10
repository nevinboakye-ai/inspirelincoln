"use client";
import Link from "next/link";
import { Radio } from "lucide-react";
import { useEffect, useState } from "react";
import type { Session } from "@/lib/types";
import { SESSION_CATEGORY_LABEL } from "@/lib/types";
import { formatTime } from "@/lib/time";

/**
 * "Happening now" and "Up next", derived only from confirmed session times.
 * With no confirmed times it says so rather than guessing.
 */
export function NowNext({ sessions }: { sessions: Session[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const timed = sessions.filter((s) => s.startsAt && s.endsAt);
  if (!timed.length) {
    return <p className="rounded-lg border border-white/10 bg-white/[0.04] p-6 text-paper/70">Live session status will appear here once session times are confirmed.</p>;
  }
  if (now == null) return null;
  const current = timed.filter((s) => new Date(s.startsAt!).getTime() <= now && now < new Date(s.endsAt!).getTime());
  const upcoming = timed.filter((s) => new Date(s.startsAt!).getTime() > now).sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
  const nextStart = upcoming[0]?.startsAt;
  const next = upcoming.filter((s) => s.startsAt === nextStart);

  const Card = ({ s, live }: { s: Session; live?: boolean }) => (
    <Link href={`/programme?session=${s.slug}`} className="block rounded-lg border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-cyan/40">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan">
        {live && <Radio aria-hidden className="size-3.5 animate-pulse-soft" />}
        {formatTime(s.startsAt!)} to {formatTime(s.endsAt!)} · {SESSION_CATEGORY_LABEL[s.category]}
      </span>
      <span className="mt-2 block font-display text-xl font-medium">{s.title}</span>
    </Link>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2" aria-live="polite">
      <div>
        <h2 className="eyebrow text-paper/50">Happening now</h2>
        <div className="mt-4 space-y-3">{current.length ? current.map((s) => <Card key={s.id} s={s} live />) : <p className="text-paper/60">No sessions are running right now.</p>}</div>
      </div>
      <div>
        <h2 className="eyebrow text-paper/50">Up next</h2>
        <div className="mt-4 space-y-3">{next.length ? next.map((s) => <Card key={s.id} s={s} />) : <p className="text-paper/60">That&apos;s everything for today.</p>}</div>
      </div>
    </div>
  );
}
