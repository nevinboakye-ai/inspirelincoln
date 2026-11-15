import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadMySpeaker } from "@/components/portal/guest-hub";
import { SpeakerForm } from "@/components/portal/speaker-form";

export const metadata: Metadata = { title: "Your speaker profile" };
export const dynamic = "force-dynamic";

export default async function SpeakerPage() {
  const { db, profile } = await requireUser("/portal/speaker");
  const mine = await loadMySpeaker(db, profile.id);
  return (
    <div className="space-y-5">
      <Link href="/portal" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> My Hub
      </Link>
      <header>
        <p className="eyebrow text-electric-600">Speaker</p>
        <h1 className="mt-1 font-display text-3xl text-ink">Your speaker profile</h1>
        <p className="mt-2 text-slate-700">What delegates read about you on the website and in the conference booklet.</p>
      </header>
      <section className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-7">
        {mine ? (
          <SpeakerForm initial={{ position: mine.position ?? "", institution: mine.institution ?? "", credentials: mine.credentials ?? "", bio: mine.bio ?? "" }} />
        ) : (
          <p className="text-slate-700">Your account isn&apos;t linked to a speaker profile yet. The committee will do this shortly.</p>
        )}
      </section>
    </div>
  );
}
