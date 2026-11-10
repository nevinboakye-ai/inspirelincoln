import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel, btn } from "@/components/admin/ui";
import { DirectEmailForm } from "@/components/admin/committee-forms";
import { RemoveRosterButton, RosterPersonForm } from "@/components/admin/person-forms";
import { removeRosterPerson } from "@/app/admin/person-actions";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import { emailConfigured } from "@/lib/email/resend";
import type { AccountStatus, AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Selected delegate" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function SelectedPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, profile } = await requireAccess("review_accounts", `/admin/accounts/selected/${id}`);

  const { data: r } = await db
    .from("delegate_roster")
    .select("id, email, full_name, institution, year_of_study, account_type, presentation_title, note, added_at")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const canEmail = profile.access.can.send_email;
  const [{ data: account }, { data: emails }] = await Promise.all([
    db.from("profiles").select("id, account_status").ilike("email", r.email).maybeSingle(),
    canEmail
      ? db.from("email_broadcasts").select("id, subject, created_at, sender_name, delivered_count").eq("recipient_email", r.email).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: null }),
  ]);
  const type = r.account_type as AccountType;

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/accounts/roster", label: "Selected delegates" }}
        title={r.full_name}
        description={<span className="break-all">{r.email}</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="violet">{ACCOUNT_TYPE_LABEL[type]}</Badge>
            {account ? <Badge tone="success">Account set up</Badge> : <Badge tone="warning">Not joined yet</Badge>}
          </div>
        }
      />

      {account ? (
        <Notice tone="info" title="They've set up their account">
          Their account is {ACCOUNT_STATUS_LABEL[account.account_status as AccountStatus].label.toLowerCase()}. Changes here only affect the selected list, so edit their details on their account instead.{" "}
          <Link href={`/admin/accounts/${account.id}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
            Open their account <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Notice>
      ) : (
        <p className="max-w-3xl text-sm text-slate-700">
          {r.full_name.split(" ")[0]} was selected but hasn&apos;t set up an account yet. When they do, with the email below, they&apos;re approved straight away with these details.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <RosterPersonForm
              person={{
                id: r.id,
                fullName: r.full_name,
                email: r.email,
                institution: r.institution,
                yearOfStudy: r.year_of_study,
                accountType: r.account_type,
                presentationTitle: r.presentation_title,
                note: r.note,
              }}
            />
          </Panel>

          {canEmail && (
            <section id="email" className="scroll-mt-28">
              <Panel title={`Email ${r.full_name.split(" ")[0]}`}>
                {!emailConfigured() && (
                  <Notice tone="warning" title="Email isn't set up yet" className="mb-4">
                    Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy.
                  </Notice>
                )}
                <DirectEmailForm
                  key={r.email}
                  people={[]}
                  locked
                  defaults={
                    account
                      ? undefined
                      : {
                          subject: "Set up your INSPIRE account",
                          body: "You've been selected to attend INSPIRE. Please set up your account using this email address, so you can see your place, add a short bio and upload anything we need from you.\n\nIt only takes a minute. Use the button below to get started.",
                        }
                  }
                  initial={{ email: r.email, full_name: r.full_name, detail: [r.institution, account ? ACCOUNT_TYPE_LABEL[type] : "Not joined yet"].filter(Boolean).join(" · "), joined: Boolean(account) }}
                />
                {(emails?.length ?? 0) > 0 && (
                  <div className="mt-6 border-t border-navy/10 pt-4">
                    <h3 className="text-sm font-semibold text-ink">Emailed to them before</h3>
                    <ul className="mt-2 divide-y divide-navy/5 text-sm">
                      {emails!.map((e) => (
                        <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                          <span className="font-medium text-ink">{e.subject}</span>
                          <span className="text-slate">{when(e.created_at)} · {e.sender_name || "Committee"}{e.delivered_count ? "" : " · Not sent"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            </section>
          )}
        </div>

        <aside className="space-y-6" aria-label={`About ${r.full_name}`}>
          <Panel title="At a glance">
            <dl className="-my-2.5 divide-y divide-navy/5 text-sm">
              <div className="py-2.5"><dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">Added to the list</dt><dd className="mt-0.5 text-ink">{when(r.added_at)}</dd></div>
              <div className="py-2.5"><dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">Account</dt><dd className="mt-0.5 text-ink">{account ? "Set up" : "Not set up yet"}</dd></div>
            </dl>
            {canEmail && !account && (
              <a href="#email" className={`${btn.secondary} mt-4 w-full`}><Mail aria-hidden className="size-4" /> Remind them to set up</a>
            )}
          </Panel>
          <Panel title="Remove from the list">
            <p className="text-sm text-slate-700">They won&apos;t be approved automatically any more.{account ? " Their account stays as it is." : ""}</p>
            <RemoveRosterButton id={r.id} name={r.full_name} action={removeRosterPerson} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
