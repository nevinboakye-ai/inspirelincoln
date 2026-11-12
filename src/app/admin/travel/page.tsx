import type { Metadata } from "next";
import Link from "next/link";
import { Bus, Car, Download, Home, Hourglass, TrainFront } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { loadTravel } from "@/lib/admin/travel";
import { TRAVEL_LABEL, TRAVEL_MODES, isTravelMode, type TravelMode } from "@/lib/travel";
import { AdminHeader, btn } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Travel and parking" };
export const dynamic = "force-dynamic";

const ICON: Record<TravelMode | "none", typeof Bus> = { inspire_coach: Bus, external_coach: Bus, train: TrainFront, car: Car, local: Home, none: Hourglass };

export default async function TravelPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAccess(["review_accounts", "manage_people"], "/admin/travel");
  const { rows, ready } = await loadTravel(db);
  const filter: TravelMode | "none" | null = isTravelMode(sp.mode) ? sp.mode : sp.mode === "none" ? "none" : null;
  const count = (m: TravelMode | "none") => rows.filter((r) => (r.mode ?? "none") === m).length;
  const shown = filter ? rows.filter((r) => (r.mode ?? "none") === filter) : rows;
  const answered = rows.length - count("none");

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Travel and parking"
        description="Approved delegates tell us in My Hub how they're getting to INSPIRE. Drivers give their car registration so parking can be arranged."
        actions={
          <>
            <a href="/admin/travel/export?mode=car" className={btn.secondary}>
              <Car aria-hidden className="size-4" /> Car registrations CSV
            </a>
            <a href="/admin/travel/export" className={btn.secondary}>
              <Download aria-hidden className="size-4" /> Everyone CSV
            </a>
          </>
        }
      />

      {!ready && (
        <Notice tone="warning" title="Run setup SQL 36 to start collecting answers">
          The travel question appears on My Hub straight away, but answers can&apos;t be saved until setup file 36 has been run in Supabase.
        </Notice>
      )}

      <section aria-labelledby="travel-summary" className="space-y-3">
        <h2 id="travel-summary" className="sr-only">Summary</h2>
        <p className="text-sm text-slate-700">
          <strong className="text-ink">{answered}</strong> of {rows.length} approved delegates have answered.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {([...TRAVEL_MODES, "none"] as const).map((m) => {
            const Icon = ICON[m];
            const active = filter === m;
            return (
              <Link
                key={m}
                href={active ? "/admin/travel" : `/admin/travel?mode=${m}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border border-navy/10 bg-white p-4 transition-shadow hover:shadow-[0_14px_34px_-22px_rgba(14,27,49,0.45)]",
                  active && "ring-2 ring-navy",
                )}
              >
                <Icon aria-hidden className="size-5 text-electric-600" />
                <span className="font-display text-3xl leading-none text-ink">{count(m)}</span>
                <span className="text-sm font-semibold text-ink">{m === "none" ? "No answer yet" : TRAVEL_LABEL[m].label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="travel-list" className="space-y-3">
        <h2 id="travel-list" className="font-display text-xl font-semibold text-ink">
          {filter ? (filter === "none" ? "No answer yet" : TRAVEL_LABEL[filter].label) : "Everyone"}
          {filter && (
            <Link href="/admin/travel" className="ml-3 align-middle font-ui text-sm font-semibold text-electric-600 underline-offset-4 hover:underline">
              Show everyone
            </Link>
          )}
        </h2>
        {!shown.length ? (
          <p className="rounded-xl border border-dashed border-navy/20 bg-white p-8 text-center text-slate-700">Nobody here yet.</p>
        ) : (
          <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
            {shown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
                <div className="min-w-0">
                  <Link href={`/admin/accounts/${r.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-sm text-slate-700">{[r.institution, r.email].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {r.carRegistration && (
                    <span className="rounded-[3px] border-2 border-ink bg-[#ffd307] px-2 py-0.5 font-ui text-sm font-bold tracking-[0.1em] text-ink">
                      <span className="sr-only">Registration </span>
                      {r.carRegistration}
                    </span>
                  )}
                  <Badge tone={r.mode ? "cyan" : "neutral"}>{r.mode ? TRAVEL_LABEL[r.mode].label : "No answer yet"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
