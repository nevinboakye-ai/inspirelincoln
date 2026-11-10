"use client";
import { useActionState, useDeferredValue, useMemo, useState } from "react";
import { Loader2, Mail, Search } from "lucide-react";
import { saveNetworkCard } from "@/app/portal/actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { Field, inputClass } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { ResultBanner } from "@/components/portal/profile-forms";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";
import type { AccountType } from "@/lib/types";

export type Delegate = {
  id: string;
  full_name: string;
  institution: string | null;
  year_of_study: string | null;
  account_type: AccountType;
  committee_position: string | null;
  bio: string | null;
  linkedin_url: string | null;
  email: string | null;
};

type CardProfile = { bio: string | null; linkedinUrl: string | null; networkShowEmail: boolean; networkListed: boolean; email: string };

export function NetworkCardForm({ profile }: { profile: CardProfile }) {
  const [state, action, pending] = useActionState(saveNetworkCard, null);
  const [bio, setBio] = useState(profile.bio ?? "");
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <Field id="bio" label="Short bio" error={fe("bio")} hint={`What you study, what you're interested in, what you'd like to talk about. ${600 - bio.length} characters left.`}>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={inputClass}
          aria-invalid={Boolean(fe("bio"))}
          aria-describedby={fe("bio") ? "bio-error" : undefined}
        />
      </Field>
      <Field id="linkedin" label="LinkedIn profile" error={fe("linkedin")} hint="For example linkedin.com/in/your-name">
        <input
          id="linkedin"
          name="linkedin"
          type="url"
          inputMode="url"
          defaultValue={profile.linkedinUrl ?? ""}
          placeholder="https://www.linkedin.com/in/"
          className={inputClass}
          aria-invalid={Boolean(fe("linkedin"))}
          aria-describedby={fe("linkedin") ? "linkedin-error" : undefined}
        />
      </Field>
      <fieldset className="space-y-3">
        <legend className="sr-only">What to share</legend>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="showEmail" defaultChecked={profile.networkShowEmail} className="mt-0.5 size-5 shrink-0 accent-navy" />
          <span>
            Show my email (<span className="break-all">{profile.email}</span>) to other delegates
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="listed" defaultChecked={profile.networkListed} className="mt-0.5 size-5 shrink-0 accent-navy" />
          <span>List me on the delegate network. Untick to hide your card completely.</span>
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-navy px-6 font-ui font-semibold text-paper hover:bg-navy-700 disabled:opacity-60 sm:w-auto">
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />} Save my card
      </button>
    </form>
  );
}

function LinkedInMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function NetworkDirectory({ people, me }: { people: Delegate[]; me: string }) {
  const [q, setQ] = useState("");
  const [uni, setUni] = useState("");
  const query = useDeferredValue(q.trim().toLowerCase());
  const unis = useMemo(() => [...new Set(people.map((p) => p.institution).filter(Boolean) as string[])].sort(), [people]);
  const shown = useMemo(
    () =>
      people.filter(
        (p) =>
          (!uni || p.institution === uni) &&
          (!query || [p.full_name, p.institution, p.bio, p.year_of_study].some((v) => v?.toLowerCase().includes(query))),
      ),
    [people, uni, query],
  );

  return (
    <section aria-labelledby="people-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="people-title" className="font-display text-xl text-ink">
          Delegates <span className="text-slate">({people.length})</span>
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <label className="relative block">
          <span className="sr-only">Search delegates</span>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, university or interest" className={`${inputClass} pl-10`} />
        </label>
        <label className="block">
          <span className="sr-only">University</span>
          <select value={uni} onChange={(e) => setUni(e.target.value)} className={inputClass}>
            <option value="">All universities</option>
            {unis.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? "delegate" : "delegates"} shown
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-navy/15 bg-white p-8 text-center text-slate-700">
          {people.length === 0 ? "No one is listed yet. Add your card above to be the first." : "No one matches that search."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <li key={p.id} className="flex gap-4 rounded-xl border border-navy/10 bg-white p-4 sm:p-5">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-navy font-ui text-sm font-semibold text-cyan">
                {initials(p.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink">
                  {p.full_name}
                  {p.id === me && <span className="ml-2 text-xs font-normal text-slate">(you)</span>}
                </h3>
                <p className="text-sm text-slate-700">{[p.institution, p.year_of_study].filter(Boolean).join(" · ")}</p>
                {p.account_type !== "delegate" && (
                  <p className="mt-2">
                    <Badge tone={p.account_type.endsWith("presenter") ? "violet" : "neutral"}>
                      {p.committee_position || ACCOUNT_TYPE_LABEL[p.account_type]}
                    </Badge>
                  </p>
                )}
                {p.bio && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{p.bio}</p>}
                {(p.linkedin_url || p.email) && (
                  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {p.linkedin_url && (
                      <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-10 items-center gap-1.5 font-medium text-electric-600 underline-offset-4 hover:underline">
                        <LinkedInMark /> LinkedIn<span className="sr-only"> profile of {p.full_name} (opens in a new tab)</span>
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="inline-flex min-h-10 min-w-0 items-center gap-1.5 font-medium text-electric-600 underline-offset-4 hover:underline">
                        <Mail aria-hidden className="size-4 shrink-0" /> <span className="truncate">{p.email}</span>
                      </a>
                    )}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
