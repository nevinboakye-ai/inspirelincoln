import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { BroadcastForm } from "@/components/admin/committee-forms";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import { emailConfigured } from "@/lib/email/resend";
import type { AccountType } from "@/lib/types";

export const metadata: Metadata = { title: "Group email" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

export default async function EmailPage() {
  const { db, profile } = await requireRole(["admin"], "/admin/email");
  if (!profile.access.leadership) redirect("/admin?denied=email");
  const [{ data: people }, { data: sent }] = await Promise.all([
    db.from("profiles").select("account_type").eq("account_status", "approved").limit(5000),
    db.from("email_broadcasts").select("id, subject, sender_name, purpose, audience_types, recipient_count, delivered_count, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const counts: Partial<Record<AccountType, number>> = {};
  for (const p of people ?? []) counts[p.account_type as AccountType] = (counts[p.account_type as AccountType] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Group email"
        description="Email everyone in chosen groups. Each person gets their own copy with their first name, so nobody sees anyone else's address. Numbers show approved accounts in each group."
      />
      {!emailConfigured() && (
        <Notice tone="warning" title="Email isn't set up yet">
          Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy. Until then you can draft and count recipients, but nothing is sent.
        </Notice>
      )}
      <Panel>
        <BroadcastForm counts={counts} />
      </Panel>
      <Panel title="Sent">
        {sent?.length ? (
          <ul className="divide-y divide-navy/10 text-sm">
            {sent.map((b) => (
              <li key={b.id} className="py-3">
                <p className="font-medium text-ink">{b.subject}</p>
                <p className="text-slate-700">
                  {when(b.created_at)} · {b.sender_name || "Committee"} · {b.purpose === "marketing" ? "News" : "Conference update"} · {(b.audience_types as AccountType[]).map((t) => ACCOUNT_TYPE_LABEL[t]).join(", ")} · {b.delivered_count} of {b.recipient_count} sent
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
