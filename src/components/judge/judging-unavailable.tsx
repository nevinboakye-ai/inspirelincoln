import Link from "next/link";
import { TriangleAlert } from "lucide-react";

export function JudgingUnavailable({ failed }: { failed?: boolean }) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-6 sm:p-8">
      <TriangleAlert aria-hidden className="size-7 text-warning" />
      <h1 className="mt-3 font-display text-2xl text-ink">{failed ? "Judging couldn't load" : "Judging isn't set up yet"}</h1>
      <p className="mt-2 text-slate-700">
        {failed
          ? "Check your connection and refresh the page. If it keeps happening, let the committee know."
          : "The committee needs to run the judging setup in Supabase (setup file “judges and speakers”) before judges can mark."}
      </p>
      <Link href="/portal" className="mt-5 inline-flex min-h-11 items-center rounded-[3px] bg-navy px-5 text-sm font-semibold text-paper">Back to My Hub</Link>
    </div>
  );
}
