import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { presenterKindOf } from "@/lib/accounts";
import { getPostConference, loadFeedbackWorkshops } from "@/lib/post-conference/server";
import { FeedbackUnlock } from "@/components/post-conference/feedback-gate";
import { AfterHome } from "@/components/post-conference/after-home";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Post-conference hub" };
export const dynamic = "force-dynamic";

/**
 * The feedback form, and a preview of My Hub after the conference. Once the
 * Post-conference hub switch is on, My Hub itself becomes the
 * post-conference hub, so this page sends people there.
 */
export default async function AfterHub({ searchParams }: { searchParams: Promise<{ thanks?: string; form?: string }> }) {
  const sp = await searchParams;
  const { db, profile } = await requireUser("/portal/after");
  const after = await getPostConference(db, profile);
  if (!after.member) redirect("/portal");
  const presenter = Boolean(presenterKindOf(profile));
  const firstName = profile.fullName?.split(" ")[0] ?? null;

  if (!after.ready) {
    return (
      <Notice tone="warning" title="One database step left">
        Run <code>20261223000000_post_conference_feedback_and_gallery.sql</code> in the Supabase SQL editor to add feedback, the post-conference hub and the gallery.
      </Notice>
    );
  }
  const workshops = sp.form || !after.done ? await loadFeedbackWorkshops(db, profile.id) : undefined;
  // The committee can look at the form without sending anything.
  if (sp.form === "preview") return <FeedbackUnlock presenter={presenter} firstName={firstName} workshops={workshops} preview />;
  // Everyone else meets the form in front of My Hub (see the portal layout). The site owner is never held up, but can open it here.
  if (!after.done && (!profile.access.owner || sp.form)) return <FeedbackUnlock presenter={presenter} firstName={firstName} workshops={workshops} />;
  // Once it's open for everyone, My Hub is the post-conference hub.
  if (after.open) redirect(sp.thanks ? "/portal?thanks=1" : "/portal");
  return <AfterHome db={db} profile={profile} after={after} thanks={Boolean(sp.thanks)} />;
}
