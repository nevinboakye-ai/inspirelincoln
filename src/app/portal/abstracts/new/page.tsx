import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getEdition } from "@/lib/data/content";
import { AbstractForm } from "@/components/portal/abstract-form";
import { Notice } from "@/components/ui/notice";

export const metadata: Metadata = { title: "Submit an abstract" };
export const dynamic = "force-dynamic";

export default async function NewAbstractPage() {
  const { profile } = await requireUser("/portal/abstracts/new");
  const edition = await getEdition();
  const cfg = edition.abstractConfig;
  return (
    <div className="rounded-xl border border-navy/10 bg-white p-6 sm:p-10">
      <p className="eyebrow text-electric-600">Research</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-ink">Submit an abstract</h1>
      {!cfg.submissionsOpen ? (
        <div className="mt-6 space-y-4">
          <Notice>Abstract submissions are not open at the moment. When the call opens, the form will appear here and on the <Link href="/research" className="underline">Research page</Link>.</Notice>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-2xl text-slate-700">
            You can save a draft at any time and come back to it from your dashboard.
            {cfg.closesAt ? ` Submissions close ${new Date(cfg.closesAt).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "full", timeStyle: "short" })} (UK time).` : ""}
          </p>
          {cfg.eligibility.length > 0 && (
            <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {cfg.eligibility.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          <div className="mt-10">
            <AbstractForm
              config={cfg}
              initial={{
                presentingAuthor: profile.fullName ?? "",
                email: profile.email,
                university: profile.institution ?? "",
                programmeYear: [profile.programme, profile.yearOfStudy].filter(Boolean).join(", "),
                title: "", coAuthors: "", category: "", presentationPreference: "",
                background: "", aim: "", methods: "", results: "", conclusion: "",
                consentData: false, declarationOriginal: false, consentShowcase: false,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
