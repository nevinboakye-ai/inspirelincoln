import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Crown, Mail, ShieldCheck } from "lucide-react";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { AccountReviewForm, DirectEmailForm } from "@/components/admin/committee-forms";
import { PersonDetailsForm } from "@/components/admin/person-forms";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL, COMMITTEE_TYPES, SUBMISSION_LABEL, SUBMISSION_STATUS_LABEL } from "@/lib/accounts";
import { emailConfigured } from "@/lib/email/resend";
import type { AccountStatus, AccountType, SubmissionKind, SubmissionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 py-2.5">
      <dt className="font-ui text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, user, profile } = await requireAccess("review_accounts", `/admin/accounts/${id}`);

  const { data: p } = await db
    .from("profiles")
    .select(
      "id, role, email, full_name, institution, programme, year_of_study, career_stage, committee_position, presentation_title, heard_about, account_type, account_status, review_note, reviewed_at, created_at, photo_opt_out, marketing_opt_in, bio, linkedin_url",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const canEmail = profile.access.can.send_email;
  const canSeeSubmissions = profile.access.can.review_submissions;
  const [{ data: registration }, { data: submissions }, { data: emails }, { data: onList }] = await Promise.all([
    db.from("registrations").select("status, checked_in_at, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    canSeeSubmissions
      ? db.from("presentation_submissions").select("id, kind, title, status, version, created_at").eq("user_id", id).order("version", { ascending: false }).limit(10)
      : Promise.resolve({ data: null }),
    canEmail
      ? db.from("email_broadcasts").select("id, subject, created_at, sender_name, delivered_count").eq("recipient_email", p.email.toLowerCase()).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: null }),
    db.from("delegate_roster").select("id").eq("email", p.email.toLowerCase()).maybeSingle(),
  ]);

  const type = p.account_type as AccountType;
  const status = p.account_status as AccountStatus;
  const st = ACCOUNT_STATUS_LABEL[status];
  const name = p.full_name || p.email;
  const ownerAccount = p.role === "admin";
  const locked = ownerAccount && !profile.access.owner;
  const back = sp.from === "email" ? { href: "/admin/email", label: "Group email" } : { href: `/admin/accounts?status=${status}`, label: "Accounts" };

  return (
    <div className="space-y-6">
      <AdminHeader
        back={back}
        title={name}
        description={<span className="break-all">{p.email}</span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {ownerAccount ? (
              <Badge tone="violet"><Crown aria-hidden className="size-3" /> Site owner</Badge>
            ) : (
              <Badge tone="violet">{ACCOUNT_TYPE_LABEL[type]}</Badge>
            )}
            <Badge tone={st.tone}>{st.label}</Badge>
            {p.id === user.id && <Badge>You</Badge>}
          </div>
        }
      />

      <nav aria-label="On this page" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2 text-sm">
          {[
            ["#details", "Details"],
            ["#decision", "Account decision"],
            ...(canEmail ? [["#email", "Email them"]] : []),
            ...(profile.access.owner && !ownerAccount ? [[`/admin/platform/people/${p.id}`, "What they can do"]] : []),
          ].map(([href, label]) => (
            <li key={href} className="shrink-0">
              <a href={href} className="flex min-h-10 items-center gap-1.5 rounded-full border border-navy/15 bg-white px-4 font-semibold text-ink hover:border-navy/40">
                {href === "#email" && <Mail aria-hidden className="size-4" />}
                {href.startsWith("/") && <ShieldCheck aria-hidden className="size-4" />}
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <section id="details" className="scroll-mt-28">
            <Panel title="Details">
              {locked ? (
                <p className="text-sm text-slate-700">This is the site owner&apos;s account. Only the site owner can change it.</p>
              ) : (
                <PersonDetailsForm
                  person={{
                    id: p.id,
                    fullName: p.full_name,
                    email: p.email,
                    institution: p.institution,
                    programme: p.programme,
                    yearOfStudy: p.year_of_study,
                    careerStage: p.career_stage,
                    committeePosition: p.committee_position,
                    presentationTitle: p.presentation_title,
                  }}
                  canChangeEmail={profile.access.owner}
                  committee={COMMITTEE_TYPES.includes(type)}
                />
              )}
            </Panel>
          </section>

          <section id="decision" className="scroll-mt-28">
            <Panel title="Account decision">
              <p className="mb-4 text-sm text-slate-700">
                Currently <strong className="text-ink">{st.label.toLowerCase()}</strong> as {ACCOUNT_TYPE_LABEL[type].toLowerCase()}.
                {p.review_note ? ` Last note: “${p.review_note}”` : ""}
                {p.reviewed_at ? ` (${when(p.reviewed_at)}).` : ""}
              </p>
              {locked ? (
                <p className="text-sm text-slate-700">Only the site owner can change the site owner&apos;s account.</p>
              ) : (
                <AccountReviewForm id={p.id} type={type} status={status} canLead={profile.access.leadership} name={name} />
              )}
            </Panel>
          </section>

          {canEmail && (
            <section id="email" className="scroll-mt-28">
              <Panel title={`Email ${p.full_name?.split(" ")[0] || "them"}`}>
                {!emailConfigured() && (
                  <Notice tone="warning" title="Email isn't set up yet" className="mb-4">
                    Add RESEND_API_KEY and EMAIL_FROM in Vercel, then redeploy.
                  </Notice>
                )}
                <DirectEmailForm
                  key={p.email}
                  people={[]}
                  locked
                  initial={{ email: p.email.toLowerCase(), full_name: p.full_name, detail: [p.institution, ACCOUNT_TYPE_LABEL[type]].filter(Boolean).join(" · "), joined: true }}
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

        <aside className="space-y-6" aria-label={`About ${name}`}>
          <Panel title="At a glance">
            <dl className="-my-2.5 divide-y divide-navy/5">
              <Fact label="Account created">{when(p.created_at)}</Fact>
              <Fact label="Selected list">{onList ? <Link href={`/admin/accounts/selected/${onList.id}`} className="font-semibold text-electric-600 underline underline-offset-4">On the selected list</Link> : "Registered themselves"}</Fact>
              <Fact label="Registration">
                {registration ? `${registration.status[0].toUpperCase()}${registration.status.slice(1)}${registration.checked_in_at ? `, checked in ${when(registration.checked_in_at)}` : ""}` : "No registration yet"}
              </Fact>
              {p.heard_about && <Fact label="Heard about us">{p.heard_about}</Fact>}
              <Fact label="News emails">{p.marketing_opt_in ? "Opted in" : "Not opted in"}</Fact>
              <Fact label="Photographs">{p.photo_opt_out ? "Prefers not to be photographed" : "No preference given"}</Fact>
            </dl>
          </Panel>

          {(p.bio || p.linkedin_url) && (
            <Panel title="Their bio">
              {p.bio && <p className="whitespace-pre-line text-sm text-ink">{p.bio}</p>}
              {p.linkedin_url && (
                <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-electric-600 underline underline-offset-4">
                  LinkedIn<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </Panel>
          )}

          {canSeeSubmissions && (
            <Panel title="Slides and posters">
              {submissions?.length ? (
                <ul className="-my-2 divide-y divide-navy/5">
                  {submissions.map((s) => {
                    const ss = SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus];
                    return (
                      <li key={s.id}>
                        <Link href={`/admin/submissions/${s.id}`} className="group flex items-start gap-2 py-2.5 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-ink group-hover:underline">{s.title}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate">
                              {SUBMISSION_LABEL[s.kind as SubmissionKind].title} · version {s.version} <Badge tone={ss.tone}>{ss.label}</Badge>
                            </span>
                          </span>
                          <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-slate" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-700">Nothing uploaded yet.</p>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
