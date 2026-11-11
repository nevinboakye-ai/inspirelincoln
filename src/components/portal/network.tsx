"use client";
import { useActionState, useCallback, useDeferredValue, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ArrowRight, Loader2, Mail, Search } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { saveNetworkCard } from "@/app/portal/actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { Field, inputClass } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { ResultBanner } from "@/components/portal/profile-forms";
import { ACCOUNT_TYPE_LABEL, COMMITTEE_TYPES, EXEC_TYPES } from "@/lib/accounts";
import { InstagramMark } from "@/components/ui/social";
import { UniLogo } from "@/components/ui/uni-logo";
import { uniKey, type LogoMap } from "@/lib/university-logos";
import { instagramUrl } from "@/lib/instagram";
import { Crown, Star } from "lucide-react";
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
  avatar_path?: string | null;
  /** A short-lived link to their photo, added by the server. */
  avatar_url?: string | null;
  instagram?: string | null;
  /** Every role they hold. */
  roles?: AccountType[];
  /** False for people on the selected list who haven't set up an account yet. Only the committee sees these. */
  joined: boolean;
};

type CardProfile = { bio: string | null; linkedinUrl: string | null; instagram: string | null; networkShowEmail: boolean; networkListed: boolean; email: string };

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
      <Field id="instagram" label="Instagram" error={fe("instagram")} hint="Your username, for example @your.name">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate">@</span>
          <input
            id="instagram"
            name="instagram"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={profile.instagram ?? ""}
            placeholder="your.name"
            className={`${inputClass} pl-9`}
            aria-invalid={Boolean(fe("instagram"))}
            aria-describedby={fe("instagram") ? "instagram-hint instagram-error" : "instagram-hint"}
          />
        </div>
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

const TONE_STYLE: Record<string, { band: string; avatar: string }> = {
  oral_presenter: { band: "bg-cyan", avatar: "bg-cyan/20 text-navy" },
  poster_presenter: { band: "bg-gold", avatar: "bg-gold/25 text-midnight" },
  delegate: { band: "bg-navy", avatar: "bg-navy text-cyan" },
  oral_waitlist: { band: "bg-navy", avatar: "bg-navy text-cyan" },
  other: { band: "bg-midnight", avatar: "bg-midnight text-gold-300" },
};
const toneFor = (t: AccountType) => TONE_STYLE[t] ?? TONE_STYLE.other;
const rolesOfP = (p: Delegate) => (p.roles?.length ? p.roles : [p.account_type]);
/** President, vice president and executive committee first, then each team in turn, then everyone else. */
const RANK: AccountType[] = ["president", "vice_president", "executive_committee", ...COMMITTEE_TYPES.filter((t) => !EXEC_TYPES.includes(t))];
const rankOf = (p: Delegate) => Math.min(...rolesOfP(p).map((r) => (RANK.includes(r) ? RANK.indexOf(r) : 99)));
const isExec = (p: Delegate) => rolesOfP(p).some((r) => EXEC_TYPES.includes(r));
const isCommittee = (p: Delegate) => rankOf(p) < 99;
/** Their committee role, most senior first. */
const committeeRole = (p: Delegate) => {
  const top = RANK[rankOf(p)];
  return top ? ACCOUNT_TYPE_LABEL[top] : null;
};
const roleLabel = (p: Delegate) => p.committee_position || committeeRole(p) || ACCOUNT_TYPE_LABEL[p.account_type];

export function NetworkDirectory({ people, me, logos = {} }: { people: Delegate[]; me: string; logos?: LogoMap }) {
  const [q, setQ] = useState("");
  const [uni, setUni] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
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
  const committee = useMemo(
    () => shown.filter(isCommittee).sort((a, b) => rankOf(a) - rankOf(b) || a.full_name.localeCompare(b.full_name)),
    [shown],
  );
  const delegates = useMemo(() => shown.filter((p) => !isCommittee(p)), [shown]);
  const selected = people.find((p) => p.id === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);

  return (
    <section aria-labelledby="people-title" className="space-y-4">
      <h2 id="people-title" className="font-display text-xl text-ink">
        Delegates <span className="text-slate">({people.length})</span>
      </h2>
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
        <div className="space-y-8">
          {committee.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-ui text-xs font-semibold uppercase tracking-[0.18em] text-gold-700">
                <Crown aria-hidden className="size-4" /> The committee <span className="font-normal normal-case tracking-normal text-slate">({committee.length})</span>
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {committee.map((p) => (
                  <li key={p.id}>
                    <CommitteeCard p={p} me={me} logo={logos[uniKey(p.institution)]} onOpen={() => setOpenId(p.id)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {delegates.length > 0 && (
            <div>
              {committee.length > 0 && (
                <h3 className="mb-3 font-ui text-xs font-semibold uppercase tracking-[0.18em] text-slate">
                  Delegates <span className="font-normal normal-case tracking-normal">({delegates.length})</span>
                </h3>
              )}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {delegates.map((p) => {
            const tone = toneFor(p.account_type);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  aria-haspopup="dialog"
                  className="group relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-navy/10 bg-white text-left shadow-[0_1px_2px_rgba(12,24,44,0.06)] transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-navy/25 hover:shadow-[0_22px_44px_-26px_rgba(26,49,84,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600"
                >
                  <span aria-hidden className={`h-1.5 w-full ${tone.band}`} />
                  <span className="flex flex-1 flex-col p-4 sm:p-5">
                    <span className="flex items-center gap-3.5">
                      <Avatar url={p.avatar_url} name={p.full_name} className="size-12 transition-transform duration-300 group-hover:scale-105" fallbackClassName={`text-sm ${tone.avatar}`} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">
                          {p.full_name}
                          {p.id === me && <span className="ml-1.5 text-xs font-normal text-slate">(you)</span>}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm text-slate-700">
                          <UniLogo src={logos[uniKey(p.institution)]} name={p.institution} className="size-5 p-0.5" />
                          <span className="truncate">{[p.institution, p.year_of_study].filter(Boolean).join(" · ") || " "}</span>
                        </span>
                      </span>
                    </span>
                    {p.bio && <span className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-700">{p.bio}</span>}
                    <span className="mt-auto flex items-center justify-between gap-2 pt-4">
                      {p.account_type !== "delegate" ? (
                        <Badge tone={p.account_type.endsWith("presenter") ? "violet" : "neutral"}>{roleLabel(p)}</Badge>
                      ) : (
                        <span />
                      )}
                      <span className="inline-flex items-center gap-1 font-ui text-xs font-semibold text-electric-600">
                        View profile <ArrowRight aria-hidden className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
            </div>
          )}
        </div>
      )}

      <Drawer open={Boolean(selected)} onClose={close} label={selected ? `${selected.full_name}'s profile` : "Profile"}>
        {selected && <PersonDetail p={selected} me={me} logo={logos[uniKey(selected.institution)]} />}
      </Drawer>
    </section>
  );
}

/** The committee's cards: dark, with a gold edge, so they stand out from delegates'. */
function CommitteeCard({ p, me, logo, onOpen }: { p: Delegate; me: string; logo?: string; onOpen: () => void }) {
  const exec = isExec(p);
  const team = committeeRole(p);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-midnight text-left text-paper shadow-[0_18px_40px_-26px_rgba(12,24,44,0.9)] ring-1 transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(12,24,44,0.9)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-600 ${exec ? "ring-gold/60" : "ring-white/10"}`}
    >
      <span aria-hidden className={`h-1.5 w-full ${exec ? "lanyard-foil" : "bg-gold/70"}`} />
      <span aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-[0.14]" />
      <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-6 -right-4 h-28 w-auto opacity-[0.06]" />
      <span className="relative flex flex-1 flex-col p-4 sm:p-5">
        <span className="flex items-center gap-3.5">
          <Avatar url={p.avatar_url} name={p.full_name} className={`size-12 ring-2 transition-transform duration-300 group-hover:scale-105 ${exec ? "ring-gold" : "ring-gold/40"}`} fallbackClassName="bg-paper/10 text-sm text-gold-300" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">
              {p.full_name}
              {p.id === me && <span className="ml-1.5 text-xs font-normal text-paper/60">(you)</span>}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-paper/70">
              <UniLogo src={logo} name={p.institution} className="size-5 p-0.5" />
              <span className="truncate">{[p.institution, p.year_of_study].filter(Boolean).join(" · ") || " "}</span>
            </span>
          </span>
        </span>
        {p.bio && <span className="mt-3 line-clamp-2 text-sm leading-relaxed text-paper/75">{p.bio}</span>}
        <span className="mt-auto flex items-center justify-between gap-2 pt-4">
          <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${exec ? "bg-gold text-midnight" : "bg-gold/15 text-gold-300 ring-1 ring-inset ring-gold/30"}`}>
            {exec && <Star aria-hidden className="size-3 shrink-0 fill-current" />}
            <span className="truncate">{p.committee_position || team}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-ui text-xs font-semibold text-gold-300">
            View <ArrowRight aria-hidden className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </span>
        {p.committee_position && team && <span className="sr-only">, {team}</span>}
      </span>
    </button>
  );
}

function PersonDetail({ p, me, logo }: { p: Delegate; me: string; logo?: string }) {
  const tone = toneFor(p.account_type);
  return (
    <div>
      <div className="relative overflow-hidden bg-midnight px-6 pb-7 pt-10 text-paper sm:px-8">
        <div aria-hidden className="lanyard-grid pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative flex items-center gap-4">
          <Avatar url={p.avatar_url} name={p.full_name} className="size-16 ring-4 ring-white/10 sm:size-20" fallbackClassName={`text-lg ${tone.avatar}`} />
          <div className="min-w-0">
            <h3 className="font-display text-2xl leading-tight">
              {p.full_name}
              {p.id === me && <span className="ml-2 align-middle text-sm font-normal text-paper/60">(you)</span>}
            </h3>
            <p className="mt-1 text-sm text-gold-300">{roleLabel(p)}</p>
          </div>
        </div>
      </div>
      <span aria-hidden className={`block h-1.5 w-full ${tone.band}`} />
      <dl className="grid gap-5 px-6 py-6 sm:px-8">
        {p.institution && (
          <div>
            <dt className="eyebrow text-slate">Medical school</dt>
            <dd className="mt-1.5 flex items-center gap-3 text-ink">
              <UniLogo src={logo} name={p.institution} fallback className="size-11 text-[0.62rem]" />
              {p.institution}
            </dd>
          </div>
        )}
        {p.year_of_study && (
          <div>
            <dt className="eyebrow text-slate">Year of study</dt>
            <dd className="mt-1 text-ink">{p.year_of_study}</dd>
          </div>
        )}
        <div>
          <dt className="eyebrow text-slate">About</dt>
          <dd className="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{p.bio || "They haven't added a bio yet."}</dd>
        </div>
      </dl>
      {(p.linkedin_url || p.instagram || p.email) && (
        <div className="flex flex-wrap gap-3 border-t border-navy/10 px-6 py-5 sm:px-8">
          {p.instagram && (
            <a href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-semibold text-ink hover:border-navy/35">
              <InstagramMark /> @{p.instagram}<span className="sr-only"> on Instagram (opens in a new tab)</span>
            </a>
          )}
          {p.linkedin_url && (
            <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper hover:bg-navy-700">
              <LinkedInMark /> LinkedIn<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {p.email && (
            <a href={`mailto:${p.email}`} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-[3px] border border-navy/15 px-4 text-sm font-semibold text-ink hover:border-navy/35">
              <Mail aria-hidden className="size-4 shrink-0" /> <span className="truncate">{p.email}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
