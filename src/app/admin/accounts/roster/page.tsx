import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { RosterAddForm } from "@/components/admin/roster-form";
import { removeRosterEntry } from "@/app/admin/people-actions";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Selected delegates" };
export const dynamic = "force-dynamic";

type Row = { email: string; full_name: string; institution: string | null; year_of_study: string | null; account_type: AccountType; presentation_title: string | null; note: string | null };

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAccess("review_accounts", "/admin/accounts/roster");
  const [{ data, error }, { data: accounts }] = await Promise.all([
    db.from("delegate_roster").select("email, full_name, institution, year_of_study, account_type, presentation_title, note").order("full_name").limit(2000),
    db.from("profiles").select("email").limit(5000),
  ]);
  const joined = new Set((accounts ?? []).map((a) => a.email.toLowerCase()));
  const all = (data ?? []) as Row[];
  const term = sp.q?.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      (!term || [r.full_name, r.email, r.institution, r.note].some((v) => v?.toLowerCase().includes(term))) &&
      (sp.show !== "waiting" || !joined.has(r.email)) &&
      (sp.show !== "notes" || r.note),
  );
  const setUp = all.filter((r) => joined.has(r.email)).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/accounts", label: "Accounts" }}
        title="Selected delegates"
        description="People on this list are approved as soon as they set up their account with this email, so they never wait for review. Anyone else who registers still appears in Accounts for review."
      />

      {error ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-5 text-sm text-ink">The selected list isn&apos;t set up in the database yet. Run the delegate network migration first.</p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["On the list", all.length],
              ["Set up their account", setUp],
              ["Not set up yet", all.length - setUp],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-navy/10 bg-white p-5">
                <dt className="text-sm text-slate-700">{k}</dt>
                <dd className="mt-1 font-display text-3xl text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <details className="rounded-xl border border-navy/10 bg-white p-5">
            <summary className="cursor-pointer font-semibold text-ink">Add someone to the list</summary>
            <div className="mt-5">
              <RosterAddForm />
            </div>
          </details>

          <form className="flex flex-wrap gap-2" role="search">
            <label htmlFor="q" className="sr-only">Search</label>
            <input id="q" name="q" defaultValue={sp.q} placeholder="Search name, email, university or note" className="min-h-11 min-w-0 flex-1 rounded-[3px] border border-navy/15 bg-white px-4 text-sm" />
            <label htmlFor="show" className="sr-only">Show</label>
            <select id="show" name="show" defaultValue={sp.show ?? ""} className="min-h-11 rounded-[3px] border border-navy/15 bg-white px-3 text-sm">
              <option value="">Everyone</option>
              <option value="waiting">Not set up yet</option>
              <option value="notes">Has a note</option>
            </select>
            <button className="min-h-11 rounded-[3px] border border-navy/15 bg-white px-4 text-sm font-semibold text-ink">Filter</button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Selected delegates, {rows.length} shown</caption>
              <thead className="border-b border-navy/10 bg-paper text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">University and year</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/5">
                {rows.map((r) => (
                  <tr key={r.email} className="align-top">
                    <td className="px-4 py-3">
                      <span className="block font-medium text-ink">{r.full_name}</span>
                      <span className="block break-all text-xs text-slate">{r.email}</span>
                      {r.note && <span className="mt-1 block max-w-md text-xs text-[#7a4a00]">{r.note}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{[r.institution, r.year_of_study].filter(Boolean).join(" · ")}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.account_type === "delegate" ? "neutral" : "violet"}>{ACCOUNT_TYPE_LABEL[r.account_type]}</Badge>
                      {r.presentation_title && <span className="mt-1 block max-w-xs text-xs text-slate">{r.presentation_title}</span>}
                    </td>
                    <td className="px-4 py-3">{joined.has(r.email) ? <Badge tone="success">Set up</Badge> : <Badge>Not yet</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={removeRosterEntry}>
                        <input type="hidden" name="email" value={r.email} />
                        <button className="min-h-10 rounded-[3px] px-3 text-xs font-semibold text-danger hover:bg-danger/5">
                          Remove<span className="sr-only"> {r.full_name}</span>
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate">Removing someone from the list doesn&apos;t change an account they have already set up.</p>
        </>
      )}
    </div>
  );
}
