import type { Metadata } from "next";
import {
  Bus, CalendarDays, Car, ClipboardCheck, FileSpreadsheet, FileStack, FileText, GraduationCap, Hourglass, ListOrdered, Mic, Package, QrCode, ShieldAlert, Sheet, UserCheck, Users, Utensils,
} from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { DATASETS, SECTIONS, canDownload } from "@/lib/exports/datasets";
import { universityName, uniKey } from "@/lib/university-logos";
import { AdminHeader, btn } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Downloads" };
export const dynamic = "force-dynamic";

const ICON: Record<string, typeof Users> = {
  attendees: Users,
  committee: UserCheck,
  accounts: Users,
  presenters: Mic,
  waitlist: Hourglass,
  submissions: FileStack,
  transport: Bus,
  cars: Car,
  workshop_places: ListOrdered,
  workshop_registers: ClipboardCheck,
  checkin: QrCode,
  dietary: Utensils,
  programme: CalendarDays,
  abstracts: FileText,
};

function href(set: string, format: string, uni: string | null, hide: boolean) {
  const q = new URLSearchParams({ set, format });
  if (uni) q.set("uni", uni);
  if (hide) q.set("contact", "hide");
  return `/admin/downloads/file?${q}`;
}

function Formats({ set, uni, hide, csv = true, label }: { set: string; uni: string | null; hide: boolean; csv?: boolean; label: string }) {
  const base = "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[3px] px-3 text-sm font-semibold sm:flex-none sm:px-4";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={href(set, "xlsx", uni, hide)} download className={cn(base, "bg-[#1d6f42] text-white hover:bg-[#185c37]")} aria-label={`${label} as Excel`}>
        <FileSpreadsheet aria-hidden className="size-4" /> Excel
      </a>
      <a href={href(set, "docx", uni, hide)} download className={cn(base, "bg-[#2b579a] text-white hover:bg-[#234a84]")} aria-label={`${label} as Word`}>
        <FileText aria-hidden className="size-4" /> Word
      </a>
      {csv && (
        <a href={href(set, "csv", uni, hide)} download className={cn(base, "border border-navy/15 bg-white text-ink hover:border-navy/40")} aria-label={`${label} as CSV`}>
          <Sheet aria-hidden className="size-4" /> CSV
        </a>
      )}
    </div>
  );
}

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<{ uni?: string; contact?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireAccess("any", "/admin/downloads");
  const sets = DATASETS.filter((d) => canDownload(d, profile.access));
  const hide = sp.contact === "hide";

  // Universities people have given, with how many people, for the picker.
  // Readers who can't see accounts get an empty list and a text box instead.
  const [{ data: profiles }, { data: roster }] = await Promise.all([
    db.from("profiles").select("email, institution, account_status").limit(5000),
    db.from("delegate_roster").select("email, institution").limit(5000),
  ]);
  const counts = new Map<string, { name: string; n: number }>();
  const seen = new Set<string>();
  for (const p of [...(profiles ?? []).filter((p) => p.account_status === "approved"), ...(roster ?? [])]) {
    const email = String(p.email).toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const name = universityName(p.institution as string | null);
    if (!name) continue;
    const k = uniKey(name);
    counts.set(k, { name, n: (counts.get(k)?.n ?? 0) + 1 });
  }
  const unis = [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const uni = sp.uni?.trim() ? universityName(sp.uni) : null;
  const packSets = sets.filter((d) => d.byUniversity);

  return (
    <div className="space-y-8">
      <AdminHeader
        title="Downloads"
        description="Download any list as an Excel spreadsheet or a Word document, ready to share with university representatives, venue staff or the rest of the committee. Choose a university to download only its people."
      />

      <form method="get" className="rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                <GraduationCap aria-hidden className="size-4 text-electric-600" /> University
              </span>
              {unis.length ? (
                <select name="uni" defaultValue={uni ?? ""} className="min-h-11 w-full rounded-[3px] border border-navy/20 bg-white px-3 text-base text-ink sm:text-sm">
                  <option value="">Every university</option>
                  {uni && !counts.has(uniKey(uni)) && <option value={uni}>{uni}</option>}
                  {unis.map((u) => (
                    <option key={u.name} value={u.name}>
                      {u.name} ({u.n})
                    </option>
                  ))}
                </select>
              ) : (
                <input name="uni" defaultValue={uni ?? ""} placeholder="Every university" className="min-h-11 w-full rounded-[3px] border border-navy/20 bg-white px-3 text-base text-ink sm:text-sm" />
              )}
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input type="checkbox" name="contact" value="hide" defaultChecked={hide} className="size-5 shrink-0 accent-navy" />
              Leave out email addresses
            </label>
          </div>
          <button type="submit" className={cn(btn.primary, "w-full sm:w-auto")}>
            Apply
          </button>
        </div>
        {(uni || hide) && (
          <p role="status" className="mt-4 rounded-md bg-cyan-300/60 px-3 py-2 text-sm text-ink">
            Every download below is {uni ? <strong>only {uni}</strong> : "for every university"}
            {hide ? ", without email addresses" : ""}.{" "}
            <a href="/admin/downloads" className="font-semibold underline">
              Clear
            </a>
          </p>
        )}
      </form>

      {packSets.length > 1 && (
        <section aria-labelledby="pack" className="overflow-hidden rounded-xl bg-navy text-paper">
          <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[3px] bg-gold text-midnight">
                <Package aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id="pack" className="font-display text-xl font-semibold">
                  {uni ? `Everything for ${uni}` : "Everything in one file"}
                </h2>
                <p className="mt-1 text-sm text-paper/75">
                  {uni
                    ? `One file with every list below that has ${uni} people in it: a sheet each in Excel, a section each in Word. Send it to the university's representative.`
                    : "Every list below in one file: a sheet each in Excel, a section each in Word. Choose a university above to make a pack for its representative."}
                </p>
              </div>
            </div>
            <div className="shrink-0 [&_a]:shadow-sm">
              <Formats set="pack" uni={uni} hide={hide} csv={false} label={uni ? `Everything for ${uni}` : "Everything"} />
            </div>
          </div>
        </section>
      )}

      {SECTIONS.map((section) => {
        const list = sets.filter((d) => d.section === section);
        if (!list.length) return null;
        return (
          <section key={section} aria-labelledby={`s-${section}`} className="space-y-3">
            <h2 id={`s-${section}`} className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-slate">
              {section}
            </h2>
            <ul className="grid gap-3 xl:grid-cols-2">
              {list.map((d) => {
                const Icon = ICON[d.key] ?? FileText;
                return (
                  <li key={d.key} className="flex flex-col gap-4 rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
                    <div className="flex gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-cyan-300 text-navy">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-ink">{d.title}</h3>
                        <p className="mt-0.5 text-sm text-slate-700">{d.description}</p>
                        {uni && !d.byUniversity && <p className="mt-1 text-xs text-slate">Not split by university, so this is the full list.</p>}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Formats set={d.key} uni={d.byUniversity ? uni : null} hide={hide} label={d.title} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="flex gap-3 rounded-md border border-gold/40 bg-gold/[0.08] p-4 text-sm text-slate-700">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
        <span>
          These files contain personal data. Share each one only with the people who need it, and ask them to delete it after the conference. Every download is recorded in the audit log.
          You only see the lists your permissions allow.
        </span>
      </p>
    </div>
  );
}
