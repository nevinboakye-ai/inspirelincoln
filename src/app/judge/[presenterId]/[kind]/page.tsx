import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, FileWarning, MapPin, UserCheck, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { signAvatar } from "@/lib/avatar";
import { loadJudging } from "@/lib/judging-server";
import { KIND_LABEL, isKind, judgeQueue, nextToMark, previewable } from "@/lib/judging";
import { Avatar } from "@/components/ui/avatar";
import { MarkForm } from "@/components/judge/mark-form";
import { JudgingUnavailable } from "@/components/judge/judging-unavailable";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MarkPage({ params }: { params: Promise<{ presenterId: string; kind: string }> }) {
  const { presenterId, kind } = await params;
  if (!UUID.test(presenterId) || !isKind(kind)) notFound();
  const { db, profile } = await requireUser(`/judge/${presenterId}/${kind}`);
  const j = await loadJudging(db, profile.id);
  if (j.missing || j.failed) return <JudgingUnavailable failed={j.failed} />;
  const entry = j.entries.find((e) => e.presenterId === presenterId && e.kind === kind);
  if (!entry) notFound();

  const canMark = profile.access.can.judge_presentations && presenterId !== profile.id;
  const queue = judgeQueue(j.entries, { me: profile.id, kinds: profile.access.can.judge_presentations ? j.kinds : ["oral", "poster"] });
  const sameKind = queue.filter((e) => e.kind === kind);
  const at = sameKind.findIndex((e) => e.presenterId === presenterId);
  const prev = at > 0 ? sameKind[at - 1] : null;
  const after = at >= 0 && at < sameKind.length - 1 ? sameKind[at + 1] : null;
  const next = nextToMark(queue, { presenterId, kind });

  const file = entry.submission;
  const view = file ? previewable(file.type) : { image: false, pdf: false };
  const [{ data: mark }, avatar, signed] = await Promise.all([
    j.settings.editionId
      ? db
          .from("judging_marks")
          .select("scores, strengths, improvements, committee_note, status, updated_at")
          .eq("edition_id", j.settings.editionId)
          .eq("judge_id", profile.id)
          .eq("presenter_id", presenterId)
          .eq("kind", kind)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    signAvatar(db, entry.avatarPath),
    file
      ? db.storage.from("submissions").createSignedUrl(file.path, 60 * 60 * 3, view.image || view.pdf ? undefined : { download: file.name })
      : Promise.resolve({ data: null }),
  ]);
  const fileUrl = signed.data?.signedUrl ?? null;
  const criteria = j.criteria.filter((c) => c.kind === kind);
  const noun = KIND_LABEL[kind].file;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/judge" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-700 hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> All {KIND_LABEL[kind].many.toLowerCase()}
        </Link>
        {at >= 0 && (
          <div className="flex items-center gap-1">
            <Link
              href={prev ? `/judge/${prev.presenterId}/${kind}` : "#"}
              aria-disabled={!prev}
              aria-label="Previous presenter"
              className={`grid size-11 place-items-center rounded-xl border border-navy/10 bg-white ${prev ? "text-ink" : "pointer-events-none text-slate/40"}`}
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <span className="min-w-14 text-center text-sm tabular-nums text-slate-700">
              {at + 1} of {sameKind.length}
            </span>
            <Link
              href={after ? `/judge/${after.presenterId}/${kind}` : "#"}
              aria-disabled={!after}
              aria-label="Next presenter"
              className={`grid size-11 place-items-center rounded-xl border border-navy/10 bg-white ${after ? "text-ink" : "pointer-events-none text-slate/40"}`}
            >
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </div>
        )}
      </div>

      <section className="enter-up overflow-hidden rounded-2xl border border-navy/10 bg-white">
        <div className="relative bg-midnight px-4 pb-4 pt-5 text-paper sm:px-6">
          <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-15" />
          <div className="relative flex items-center gap-4">
            <Avatar url={avatar} name={entry.name} className="size-16 text-lg ring-2 ring-gold/70" fallbackClassName="bg-navy text-cyan" />
            <div className="min-w-0">
              <p className="eyebrow text-gold">
                {KIND_LABEL[kind].one}
                {entry.label ? ` · ${entry.label}` : ""}
              </p>
              <h1 className="mt-1 font-display text-2xl leading-tight">{entry.name}</h1>
              {entry.institution && <p className="mt-0.5 truncate text-sm text-paper/70">{entry.institution}</p>}
            </div>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {entry.title ? <p className="font-display text-lg leading-snug text-ink">{entry.title}</p> : <p className="text-sm text-slate">No title given yet.</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            {entry.label && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 font-semibold text-gold-700">
                <MapPin aria-hidden className="size-3.5" /> {entry.label}
              </span>
            )}
            {entry.checkedIn ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success">
                <UserCheck aria-hidden className="size-3.5" /> Checked in
              </span>
            ) : entry.attendance === "unavailable" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 font-semibold text-danger">
                <UserX aria-hidden className="size-3.5" /> Said they can&apos;t attend
              </span>
            ) : null}
            {entry.marksIn > 0 && <span className="rounded-full bg-paper-200 px-2.5 py-1 font-medium text-slate-700">Marked by {entry.marksIn} judge{entry.marksIn === 1 ? "" : "s"}</span>}
          </div>
          {file && fileUrl ? (
            <div className="space-y-3">
              {view.image && (
                <a href={fileUrl} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-navy/10 bg-paper">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl} alt={`${entry.name}'s poster`} className="max-h-[28rem] w-full object-contain" />
                </a>
              )}
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-navy/15 bg-paper px-4 text-sm font-semibold text-ink transition-colors hover:border-navy/40"
              >
                {view.image || view.pdf ? <ExternalLink aria-hidden className="size-4" /> : <Download aria-hidden className="size-4" />}
                {view.image || view.pdf ? `Open the ${noun}` : `Download the ${noun}`}
                <span className="truncate font-normal text-slate">({file.name})</span>
              </a>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm text-slate-700">
              <FileWarning aria-hidden className="size-4 shrink-0 text-warning" /> No {noun} uploaded yet. Mark from the presentation itself.
            </p>
          )}
        </div>
      </section>

      <MarkForm
        key={`${presenterId}-${kind}`}
        presenterId={presenterId}
        kind={kind}
        presenterName={entry.name}
        criteria={criteria}
        open={j.settings.open}
        canMark={canMark}
        initial={{
          scores: (mark?.scores as Record<string, number> | null) ?? {},
          strengths: mark?.strengths ?? "",
          improvements: mark?.improvements ?? "",
          note: mark?.committee_note ?? "",
          status: mark?.status === "submitted" ? "submitted" : mark?.status === "draft" ? "draft" : null,
          updatedAt: mark?.updated_at ?? null,
        }}
        next={next ? { href: `/judge/${next.presenterId}/${next.kind}`, name: next.name, label: next.label } : null}
      />
    </div>
  );
}
