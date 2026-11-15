import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { JudgeNav } from "@/components/judge/judge-nav";

export const metadata: Metadata = { title: { default: "Judging", template: "%s · INSPIRE judging" }, robots: { index: false, follow: false } };

/**
 * The judging portal. Built for a phone held in one hand while walking
 * between posters: big targets, a bottom bar within thumb reach, and
 * everything a judge needs on one screen.
 */
export default async function JudgeLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/judge");
  if (!profile.access.judging && !profile.access.owner) redirect("/portal?denied=1");
  return (
    <div className="min-h-screen bg-paper pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-20 sm:pt-24">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">{children}</div>
      <JudgeNav results={profile.access.can.manage_judging || profile.access.owner} />
    </div>
  );
}
