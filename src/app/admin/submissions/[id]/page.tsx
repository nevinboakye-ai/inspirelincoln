import type { Metadata } from "next";
import { FilePreview } from "@/components/admin/file-preview";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { FeedbackForm } from "@/components/admin/committee-forms";
import { FeedbackThread } from "@/components/portal/submission-ui";
import { Badge } from "@/components/ui/badge";
import { SUBMISSION_LABEL, SUBMISSION_STATUS_LABEL } from "@/lib/accounts";
import type { SubmissionKind, SubmissionStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Review submission" };
export const dynamic = "force-dynamic";

const when = (d: string) => new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" });
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAccess("review_submissions", `/admin/submissions/${id}`);
  const { data: s } = await db.from("presentation_submissions").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const [{ data: versions }, { data: feedback }, signed] = await Promise.all([
    db.from("presentation_submissions").select("id, version, created_at, status").eq("user_id", s.user_id).eq("kind", s.kind).order("version", { ascending: false }),
    db.from("submission_feedback").select("id, author_name, decision, body, created_at, submission_id").in(
      "submission_id",
      (await db.from("presentation_submissions").select("id").eq("user_id", s.user_id).eq("kind", s.kind)).data?.map((v) => v.id) ?? [id],
    ).order("created_at"),
    db.storage.from("submissions").createSignedUrl(s.file_path, 60 * 30, { download: s.file_name }),
  ]);
  const preview = (await db.storage.from("submissions").createSignedUrl(s.file_path, 60 * 30)).data?.signedUrl ?? null;
  const st = SUBMISSION_STATUS_LABEL[s.status as SubmissionStatus];
  const kind = s.kind as SubmissionKind;
  const versionOf = new Map((versions ?? []).map((v) => [v.id, v.version]));

  return (
    <div className="space-y-6">
      <AdminHeader
        back={{ href: "/admin/submissions", label: "Slides and posters" }}
        title={s.title}
        description={<>{s.presenter_name || "Presenter"} · {SUBMISSION_LABEL[kind].title} · version {s.version} · uploaded {when(s.created_at)}</>}
        actions={<Badge tone={st.tone}>{st.label}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="File">
            <p className="text-sm text-slate-700">{s.file_name} · {size(s.file_size)}</p>
            {"qr_code_confirmed" in s && (
              <p className="mt-2 text-sm">
                {s.qr_code_confirmed ? (
                  <Badge tone="success">QR code added, confirmed by presenter</Badge>
                ) : (
                  <Badge tone="neutral">Uploaded before the QR code check</Badge>
                )}
              </p>
            )}
            {s.presenter_note && <p className="mt-3 rounded-md bg-paper p-4 text-sm text-ink"><span className="font-semibold">From the presenter:</span> {s.presenter_note}</p>}
            {preview && (
              <div className="mt-4">
                <FilePreview url={preview} downloadUrl={signed.data?.signedUrl} name={s.file_name} mime={s.file_type} title={`${SUBMISSION_LABEL[kind].title}: ${s.title}`} />
              </div>
            )}
            <p className="mt-4 text-xs text-slate">Links expire after 30 minutes. Refresh the page for new ones.</p>
          </Panel>
          {(versions?.length ?? 0) > 1 && (
            <Panel title="Versions">
              <ul className="divide-y divide-navy/10 text-sm">
                {versions!.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                    <a href={`/admin/submissions/${v.id}`} aria-current={v.id === id ? "page" : undefined} className="font-medium text-electric-600 underline-offset-4 hover:underline aria-[current=page]:text-ink">
                      Version {v.version}
                    </a>
                    <span className="text-slate-700">{when(v.created_at)}</span>
                    <Badge tone={SUBMISSION_STATUS_LABEL[v.status as SubmissionStatus].tone}>{SUBMISSION_STATUS_LABEL[v.status as SubmissionStatus].label}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Give feedback">
            <FeedbackForm submissionId={id} />
          </Panel>
          <Panel title="Feedback so far">
            <FeedbackThread items={(feedback ?? []).map((f) => ({ ...f, version: versionOf.get(f.submission_id) ?? null }))} empty="No feedback yet." />
          </Panel>
        </div>
      </div>
    </div>
  );
}
