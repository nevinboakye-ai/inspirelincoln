import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AdminHeader, btn } from "@/components/admin/ui";
import { DeleteEnquiry, EnquiryStatus } from "@/components/admin/people-forms";
import { Notice } from "@/components/ui/notice";
import { emailConfigured } from "@/lib/email/resend";

export const metadata: Metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

const CATEGORY: Record<string, string> = { general: "General", speakers_workshops: "Speakers & workshops", research_abstracts: "Research & abstracts", partnerships: "Partnerships", accessibility: "Accessibility" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireRole(["admin"], "/admin/enquiries");
  let q = db.from("contact_enquiries").select("*").order("created_at", { ascending: false }).limit(300);
  if (sp.status) q = q.eq("status", sp.status);
  const { data } = await q;
  return (
    <div className="space-y-6">
      <AdminHeader title="Enquiries" description="Messages sent through the contact form. Delete enquiries once resolved; the privacy notice says they are kept for no longer than 12 months." />
      {!emailConfigured() && <Notice tone="warning">Email delivery isn&apos;t configured, so enquiries are only stored here. Add the Resend settings to also receive them by email.</Notice>}
      <form className="flex gap-2">
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={sp.status ?? ""} className="min-h-11 rounded-full border border-navy/15 bg-white px-4 text-sm">
          <option value="">All</option><option value="new">New</option><option value="in_progress">In progress</option><option value="closed">Closed</option>
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      {!(data ?? []).length && <p className="text-sm text-slate-700">No enquiries.</p>}
      <ul className="space-y-4">
        {(data ?? []).map((e) => (
          <li key={e.id} className="rounded-xl border border-navy/10 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{e.subject}</p>
                <p className="text-sm text-slate-700">{e.name} · <a className="underline" href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${e.subject}`)}`}>{e.email}</a> · {CATEGORY[e.category] ?? e.category}</p>
                <p className="text-xs text-slate">{new Date(e.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}{e.delivered ? " · emailed" : ""}</p>
              </div>
              <div className="flex items-center gap-2"><EnquiryStatus id={e.id} status={e.status} /><DeleteEnquiry id={e.id} /></div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{e.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
