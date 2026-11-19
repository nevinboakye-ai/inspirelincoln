import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Notice } from "@/components/ui/notice";
import { Questionnaire } from "@/components/research/questionnaire";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/research/instrument";
import { getMyResearch } from "@/lib/research/server";

export const metadata: Metadata = { title: "Research questionnaire", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ResearchStagePage({ params, searchParams }: { params: Promise<{ stage: string }>; searchParams: Promise<{ preview?: string }> }) {
  const [{ stage: raw }, sp] = await Promise.all([params, searchParams]);
  if (!STAGES.includes(raw as Stage)) notFound();
  const stage = raw as Stage;
  const { db, profile } = await requireUser(`/portal/research/${stage}`);
  const r = await getMyResearch(db, profile);
  const preview = Boolean(sp.preview) && r.canPreview && r.due !== stage;
  // Participants reach a questionnaire only while it's theirs to do.
  if (!preview && r.due !== stage) redirect("/portal/research");

  return (
    <div className="space-y-4">
      <Link href="/portal/research" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Research study
      </Link>
      {preview && (
        <Notice tone="warning" title="Preview">
          This is the questionnaire exactly as participants see it. Nothing you enter is saved.
        </Notice>
      )}
      <header>
        <p className="eyebrow text-electric-600">Research study · {STAGE_LABEL[stage].short}</p>
        <h1 className="mt-1 font-display text-3xl text-ink">{STAGE_LABEL[stage].title}</h1>
        <p className="mt-1 max-w-2xl text-slate-700">
          About {STAGE_LABEL[stage].minutes} minutes. Answer honestly: there are no right answers, and low numbers and &quot;no&quot; are just as useful. Your answers save on this device as you go, and you can come back to finish.
        </p>
      </header>
      <Questionnaire stage={stage} code={r.code} preview={preview} />
    </div>
  );
}
