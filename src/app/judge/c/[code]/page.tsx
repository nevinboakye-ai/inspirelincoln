import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CARD_CODE, cleanCode } from "@/lib/card";
import { isKind } from "@/lib/judging";

export const dynamic = "force-dynamic";

/** /judge/c/<card code>: a judge's shortcut from a Delegate Card to marking that presenter. */
export default async function JudgeCard({ params }: { params: Promise<{ code: string }> }) {
  const code = cleanCode((await params).code);
  if (!CARD_CODE.test(code)) notFound();
  const { db } = await requireUser(`/judge/c/${code}`);
  const { data } = await db.rpc("judging_lookup", { code });
  const res = (data ?? {}) as { state?: string; presenter_id?: string; kinds?: string[] };
  const kinds = (res.kinds ?? []).filter(isKind);
  if (res.state === "ok" && res.presenter_id && kinds.length === 1) redirect(`/judge/${res.presenter_id}/${kinds[0]}`);
  redirect("/judge/scan");
}
