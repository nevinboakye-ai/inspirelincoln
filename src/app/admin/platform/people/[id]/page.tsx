import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, UserCheck } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AccountTypePicker } from "@/components/admin/account-type-picker";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { PersonAccess } from "@/components/admin/platform-forms";
import { ViewAsButton } from "@/components/admin/view-as";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, CAPABILITIES, DEFAULT_RULES, type Capability } from "@/lib/accounts";
import { effectiveFor, type OverrideMode } from "@/lib/accounts/effective";
import type { AccountStatus, AccountType, UserRole } from "@/lib/types";

export const metadata: Metadata = { title: "Individual access" };
export const dynamic = "force-dynamic";

export default async function PersonAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, profile } = await requireAccess("owner", `/admin/platform/people/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: person }, { data: rules }, { data: overrides }] = await Promise.all([
    db.from("profiles").select("id, full_name, email, account_type, account_status, role, committee_position").eq("id", id).maybeSingle(),
    db.from("access_rules").select("account_type, capability, allowed"),
    db.from("access_overrides").select("capability, allowed").eq("user_id", id),
  ]);
  if (!person) notFound();

  const type = person.account_type as AccountType;
  const status = person.account_status as AccountStatus;
  const role = person.role as UserRole;
  const ruleMap = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t, Object.fromEntries(CAPABILITIES.map((c) => [c, DEFAULT_RULES[t].includes(c)]))])) as Record<AccountType, Record<Capability, boolean>>;
  for (const r of rules ?? []) if (ruleMap[r.account_type as AccountType]) ruleMap[r.account_type as AccountType][r.capability as Capability] = r.allowed;

  // What they'd have from their account type alone, ignoring any individual changes.
  const base = effectiveFor({ role, accountType: type, accountStatus: status }, ruleMap, {});
  const defaults = Object.fromEntries(CAPABILITIES.map((c) => [c, base[c].allowed])) as Record<Capability, boolean>;
  const initial = Object.fromEntries(CAPABILITIES.map((c) => {
    const o = (overrides ?? []).find((x) => x.capability === c);
    return [c, o ? (o.allowed ? "allow" : "block") : "inherit"];
  })) as Record<Capability, OverrideMode>;

  const name = person.full_name || person.email;
  const st = ACCOUNT_STATUS_LABEL[status];

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/platform#people", label: "Platform dashboard" }}
        title={name}
        description={person.email}
        actions={
          <div className="flex flex-wrap gap-2">
            {role === "admin" ? <Badge tone="violet"><Crown aria-hidden className="size-3" /> Site owner</Badge> : <Badge tone="violet">{ACCOUNT_TYPE_LABEL[type]}</Badge>}
            <Badge tone={st.tone}>{st.label}</Badge>
            {person.committee_position && <Badge>{person.committee_position}</Badge>}
            {role !== "admin" && <ViewAsButton id={person.id} name={name} back={`/admin/platform/people/${person.id}`} />}
          </div>
        }
      />

      {role === "admin" ? (
        <Notice tone="info" title="Site owner">
          {person.id === profile.id ? "This is you. " : ""}Site owners always have every permission, so there is nothing to change here.
        </Notice>
      ) : (
        <>
          {status !== "approved" && (
            <Notice tone="warning" title={`This account is ${st.label.toLowerCase()}`}>
              Their account type gives them nothing until they are approved. Anything you allow here works straight away{status === "declined" ? ", except for declined accounts, which get nothing" : ""}.{" "}
              <Link href={`/admin/accounts?status=${status}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-4">
                <UserCheck aria-hidden className="size-4" /> Review their account
              </Link>
            </Notice>
          )}
          <p className="max-w-3xl text-sm text-slate-700">
            <strong className="text-ink">Default</strong> follows what you&apos;ve set for {ACCOUNT_TYPE_LABEL[type].toLowerCase()} accounts. <strong className="text-ink">Allow</strong> or <strong className="text-ink">Block</strong> applies to {name} only. Changes save straight away and are recorded in the audit log.
          </p>
          <Panel title="Account type">
            <AccountTypePicker id={person.id} type={type} status={status} canLead={profile.access.leadership} name={name} />
          </Panel>
          <PersonAccess userId={person.id} name={name} initial={initial} defaults={defaults} />
        </>
      )}
    </div>
  );
}
