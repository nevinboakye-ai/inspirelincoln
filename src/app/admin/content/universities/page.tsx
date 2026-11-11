import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { Notice } from "@/components/ui/notice";
import { UniversityLogoRow } from "@/components/admin/university-logo-row";
import { BUILT_IN_LOGOS, logoUrl, uniKey } from "@/lib/university-logos";

export const metadata: Metadata = { title: "University logos" };
export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  const { db } = await requireAccess("edit_website", "/admin/content/universities");
  const { data, error } = await db.rpc("university_list");
  const rows = (data ?? []) as { institution: string; people: number; path: string | null }[];
  const done = rows.filter((r) => r.path || BUILT_IN_LOGOS[uniKey(r.institution)]).length;
  return (
    <div className="space-y-6">
      <AdminHeader
        title="University logos"
        description="Each university delegates have entered, most people first. A logo shows next to the university on Delegate Cards, scanned cards and the delegate network. Logos for the main universities come from their own websites. Where there's no logo, a small badge with the university's initials shows instead."
      />
      <Notice title="Before adding a logo">
        University logos are trademarks. Please check each university is happy for its logo to be used for INSPIRE, including the ones taken from their websites. To use a different version, upload it from the university&apos;s brand or press page. PNG with a transparent background, up to 512 KB, works best.
      </Notice>
      {error ? (
        <Notice tone="warning">University logos aren&apos;t set up yet. Run the latest setup SQL first.</Notice>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-700">No universities yet.</p>
      ) : (
        <section aria-labelledby="unis">
          <h2 id="unis" className="mb-3 text-sm font-semibold text-slate-700">
            {done} of {rows.length} have a logo
          </h2>
          <ul className="divide-y divide-navy/10 overflow-hidden rounded-xl border border-navy/10 bg-white">
            {rows.map((r) => (
              <UniversityLogoRow key={r.institution} institution={r.institution} people={Number(r.people)} src={r.path ? logoUrl(r.path) : null} builtIn={BUILT_IN_LOGOS[uniKey(r.institution)] ?? null} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
