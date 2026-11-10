import type { Metadata } from "next";
import { Sparkles, Users } from "lucide-react";
import { setNetworkOpen } from "@/app/portal/actions";
import { requireUser } from "@/lib/auth";
import { Notice } from "@/components/ui/notice";
import { NetworkCardForm, NetworkDirectory, type Delegate } from "@/components/portal/network";

export const metadata: Metadata = { title: "Delegate network" };
export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const { profile, db } = await requireUser("/portal/network");
  const owner = profile.access.owner;
  const { data: sw } = await db.from("site_switches").select("enabled").eq("key", "network_open").maybeSingle();
  // If the switch table isn't there yet, keep the network closed to everyone but the owner.
  const live = Boolean(sw?.enabled);
  if (!live && !owner) return <ComingSoon />;
  const staff = profile.access.exec || profile.access.owner;
  const open = profile.accountStatus === "approved" || profile.siteRole === "admin" || staff;
  const [{ data, error }, { data: waiting }] = open
    ? await Promise.all([db.rpc("network_directory"), db.rpc("selected_waiting_count")])
    : [{ data: null, error: null }, { data: 0 }];
  const people = (data ?? []) as Delegate[];

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-2 text-gold"><Users aria-hidden className="size-4" /> Delegate network</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Meet who&apos;s coming</h1>
          <p className="mt-3 max-w-xl text-sm text-paper/75 sm:text-base">
            Everyone with a confirmed place, from every medical school. Add a short bio and your LinkedIn so people can find you before and after the day.
          </p>
        </div>
      </header>

      {owner && (
        <form action={setNetworkOpen} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 px-5 py-4">
          <p className="text-sm text-ink">
            {live ? (
              <><strong>The network is open.</strong> Every confirmed delegate can see it.</>
            ) : (
              <><strong>Only you can see this.</strong> Everyone else sees &ldquo;Coming soon&rdquo; until you open it.</>
            )}
          </p>
          {!live && <input type="hidden" name="open" value="on" />}
          <button className={live ? "min-h-11 rounded-[3px] border border-navy/20 bg-white px-4 text-sm font-semibold text-ink" : "min-h-11 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper"}>
            {live ? "Close it again" : "Open to delegates"}
          </button>
        </form>
      )}

      {!open ? (
        <Notice title="The network opens when your place is confirmed">
          Once the committee confirms your account you&apos;ll be able to see other delegates here and add your own card.
        </Notice>
      ) : (
        <>
          <section className="rounded-xl border border-navy/10 bg-white p-5 sm:p-7" aria-labelledby="card-title">
            <h2 id="card-title" className="font-display text-xl text-ink">Your card</h2>
            <p className="mt-1 text-sm text-slate-700">
              Your name, university and year are shown to other confirmed delegates. Everything else is up to you.
            </p>
            <div className="mt-5">
              <NetworkCardForm profile={{ bio: profile.bio, linkedinUrl: profile.linkedinUrl, networkShowEmail: profile.networkShowEmail, networkListed: profile.networkListed, email: profile.email }} />
            </div>
          </section>

          {error ? (
            <Notice tone="warning">The network isn&apos;t available just now. Please try again later.</Notice>
          ) : (
            <NetworkDirectory people={people} me={profile.id} staff={staff} waiting={typeof waiting === "number" ? waiting : 0} />
          )}
        </>
      )}
    </div>
  );
}

function ComingSoon() {
  return (
    <section aria-labelledby="soon-title" className="relative overflow-hidden rounded-xl bg-midnight p-8 text-center text-paper sm:p-14">
      <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-12 left-1/2 h-64 w-auto -translate-x-1/2 opacity-[0.05]" />
      <div className="relative">
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
          <Sparkles aria-hidden className="size-6" />
        </span>
        <p className="eyebrow mt-6 text-gold">Delegate network</p>
        <h1 id="soon-title" className="mt-3 font-display text-4xl">Coming soon</h1>
        <p className="mx-auto mt-4 max-w-md text-paper/75">
          A place to meet the other delegates, from every medical school, before the day. Check back here soon.
        </p>
      </div>
    </section>
  );
}
