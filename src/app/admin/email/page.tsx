import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { BroadcastForm, DirectEmailForm } from "@/components/admin/committee-forms";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import { emailConfigured } from "@/lib/email/resend";
import type { AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Group email" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function EmailPage() {
  const { db } = await requireAccess("send_email", "/admin/email");
  const [{ data: people }, { data: sent }, { data: directory }] = await Promise.all([
    db.rpc("audience_counts"),
    db.from("email_broadcasts").select("*").order("created_at", { ascending: false }).limit(20),
    db.rpc("email_directory"),
  ]);
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
      <Panel title="Email a group">
        <BroadcastForm counts={counts} selected={selected} />
      </Panel>
      <Panel title="Email one person">
        <DirectEmailForm people={everyone} />
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
                    : <>{b.purpose === "marketing" ? "News" : "Conference update"} · {(b.audience_types as AccountType[]).map((t) => ACCOUNT_TYPE_LABEL[t]).join(", ")}{b.include_selected ? " and selected delegates not yet joined" : ""} · {b.delivered_count} of {b.recipient_count} sent</>}
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
