import { requireUser } from "@/lib/auth";
import { loadJudging } from "@/lib/judging-server";
import { greetingName, judgeQueue } from "@/lib/judging";
import { JudgeBoard } from "@/components/judge/judge-board";
import { JudgingUnavailable } from "@/components/judge/judging-unavailable";

export const dynamic = "force-dynamic";

export default async function JudgeHome() {
  const { db, profile } = await requireUser("/judge");
  const j = await loadJudging(db, profile.id, { avatars: true });
  if (j.missing || j.failed) return <JudgingUnavailable failed={j.failed} />;
  const canMark = profile.access.can.judge_presentations;
  // The committee checking the portal sees everyone; judges see what they've been given.
  const queue = judgeQueue(j.entries, { me: profile.id, kinds: canMark ? j.kinds : ["oral", "poster"] });
  return <JudgeBoard firstName={greetingName(profile.fullName)} queue={queue} open={j.settings.open} canMark={canMark} />;
}
