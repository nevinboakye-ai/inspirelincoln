import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { RosterAddForm } from "@/components/admin/roster-form";
import { InlineTypeSelect } from "@/components/admin/type-select";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Selected delegates" };
export const dynamic = "force-dynamic";

type Row = { id: string; email: string; full_name: string; institution: string | null; year_of_study: string | null; account_type: AccountType; presentation_title: string | null; note: string | null };

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; removed?: string }> }) {
  const sp = await searchParams;
  const { db, user, profile } = await requireAccess("review_accounts", "/admin/accounts/roster");
  const canLead = profile.access.leadership;
  const [{ data, error }, { data: accounts }] = await Promise.all([
    db.from("delegate_roster").select("id, email, full_name, institution, year_of_study, account_type, presentation_title, note").order("full_name").limit(2000),
    db.from("profiles").select("id, email, account_type, role").limit(5000),
  ]);
  type Account = { id: string; email: string; account_type: AccountType; role: string | null };
  const byEmail = new Map(((accounts ?? []) as Account[]).map((a) => [a.email.toLowerCase(), a]));
  const accountId = new Map([...byEmail].map(([e, a]) => [e, a.id]));
  const joined = new Set(accountId.keys());
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
        description="People on this list are approved as soon as they set up their account with this email, so they never wait for review. Set anyone's account type from its dropdown, including committee teams, and they'll have it from the moment they sign up. Anyone else who registers still appears in Accounts for review."
      />

      {sp.removed && <p role="status" className="rounded-md border border-success/25 bg-success/[0.06] p-4 text-sm font-medium text-success">Removed from the selected list.</p>}

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
              <RosterAddForm canLead={canLead} />
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
              <caption className="sr-only">Selected delegates, {rows.length} shown. Each type dropdown saves as soon as you change it.</caption>
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
                      <Link href={`/admin/accounts/selected/${r.id}`} className="block font-medium text-ink underline-offset-4 hover:underline">{r.full_name}</Link>
                      <span className="block break-all text-xs text-slate">{r.email}</span>
                      {r.note && <span className="mt-1 block max-w-md text-xs text-[#7a4a00]">{r.note}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{[r.institution, r.year_of_study].filter(Boolean).join(" · ")}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const a = byEmail.get(r.email);
                        // Once they've signed up, the dropdown changes their account rather than the list entry.
                        if (a)
                          return (a.role !== "admin" || profile.access.owner) && (a.id !== user.id || canLead) ? (
                            <InlineTypeSelect id={a.id} type={a.account_type} kind="account" canLead={canLead} name={r.full_name} />
                          ) : (
                            <Badge tone="violet">{ACCOUNT_TYPE_LABEL[a.account_type]}</Badge>
                          );
                        return <InlineTypeSelect id={r.id} type={r.account_type} kind="roster" canLead={canLead} name={r.full_name} />;
                      })()}
                      {r.presentation_title && <span className="mt-1 block max-w-xs text-xs text-slate">{r.presentation_title}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {joined.has(r.email) ? (
                        <Link href={`/admin/accounts/${accountId.get(r.email)}`} className="inline-flex min-h-10 items-center"><Badge tone="success">Set up</Badge><span className="sr-only">, open {r.full_name}&apos;s account</span></Link>
                      ) : (
                        <Badge>Not yet</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/accounts/selected/${r.id}`} className="inline-flex min-h-10 items-center gap-1 whitespace-nowrap rounded-[3px] px-3 text-xs font-semibold text-ink hover:bg-paper">
                        Edit or email<span className="sr-only"> {r.full_name}</span> <ArrowRight aria-hidden className="size-3.5" />
                      </Link>
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
