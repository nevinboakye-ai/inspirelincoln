import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { BroadcastForm, DirectEmailForm } from "@/components/admin/committee-forms";
import { ReminderForm } from "@/components/admin/reminder-form";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import { emailConfigured } from "@/lib/email/resend";
import { loadEmailTemplates } from "@/lib/email/saved-templates";
import type { NotAcceptedGroup } from "@/lib/email/presets";
import type { AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Group email" };
export const dynamic = "force-dynamic";
// Sending with login details sets up accounts one by one, so allow time for a large group.
export const maxDuration = 300;

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function EmailPage() {
  const { db } = await requireAccess("send_email", "/admin/email");
  const [{ data: people }, { data: sent }, { data: directory }, notAccepted, templates] = await Promise.all([
    db.rpc("audience_counts"),
    db.from("email_broadcasts").select("*").order("created_at", { ascending: false }).limit(20),
    db.rpc("email_directory"),
    db.rpc("not_accepted_recipients"),
    loadEmailTemplates(db),
  ]);
  // Null until setup file 48 is run, so the form can say so.
  const notAcceptedCounts: Record<NotAcceptedGroup, number> | null = notAccepted.error
    ? null
    : {
        attending: ((notAccepted.data ?? []) as { attending: boolean }[]).filter((r) => r.attending).length,
        not_attending: ((notAccepted.data ?? []) as { attending: boolean }[]).filter((r) => !r.attending).length,
      };
  const everyone = (directory ?? []) as { email: string; full_name: string | null; detail: string; joined: boolean }[];
  const selected = everyone.filter((p) => !p.joined).length;
  const counts: Partial<Record<AccountType, number>> = {};
  for (const p of (people ?? []) as { account_type: AccountType; account_status: string; total: number }[])
    if (p.account_status === "approved") counts[p.account_type] = (counts[p.account_type] ?? 0) + Number(p.total);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Group email"
        description="Email a whole group or one person. Each person gets their own copy with their first name, so nobody sees anyone else's address. Numbers show approved accounts in each group."
      />
      {!emailConfigured() && (
        <Notice tone="warning" title="Email isn't set up yet">
          Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy. Until then you can draft and count recipients, but nothing is sent.
        </Notice>
      )}
      <Panel title="Deadline reminders">
        <p className="-mt-2 mb-5 text-sm text-slate-700">
          Remind people what they still need to do, by when, and that their place may be given to someone else. Each person gets their own checklist, worked out from their account, so nobody is asked for something they&apos;ve already done.
        </p>
        <ReminderForm />
      </Panel>
      <Panel title="Email a group">
        <BroadcastForm counts={counts} selected={selected} templates={templates} notAcceptedCounts={notAcceptedCounts} />
      </Panel>
      <Panel title="Email one person">
        <DirectEmailForm people={everyone} templates={templates} />
      </Panel>
      <Panel title="Sent">
        {sent?.length ? (
          <ul className="divide-y divide-navy/10 text-sm">
            {sent.map((b) => (
              <li key={b.id} className="py-3">
                <p className="font-medium text-ink">{b.subject}</p>
                <p className="text-slate-700">
                  {when(b.created_at)} · {b.sender_name || "Committee"} ·{" "}
                  {b.recipient_email
                    ? <>To {b.recipient_email} · {b.delivered_count ? "Sent" : "Not sent"}</>
                    : <>{b.purpose === "marketing" ? "News" : "Conference update"} · {[...(b.audience_types as AccountType[]).map((t) => ACCOUNT_TYPE_LABEL[t]), ...(b.audience_note ? [b.audience_note as string] : [])].join(", ")}{b.include_selected ? " and people not yet signed up" : ""} · {b.delivered_count} of {b.recipient_count} sent</>}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-700">Nothing sent yet.</p>
        )}
      </Panel>
    </div>
  );
}
