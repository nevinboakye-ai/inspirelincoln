import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Notice } from "@/components/ui/notice";
import { NetworkCardForm, NetworkDirectory, type Delegate } from "@/components/portal/network";

export const metadata: Metadata = { title: "Delegate network" };
export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const { profile, db } = await requireUser("/portal/network");
  const open = profile.accountStatus === "approved" || profile.siteRole === "admin";
  const { data, error } = open ? await db.rpc("network_directory") : { data: null, error: null };
  const people = ((data ?? []) as Delegate[]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-2 text-cyan"><Users aria-hidden className="size-4" /> Delegate network</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Meet who&apos;s coming</h1>
          <p className="mt-3 max-w-xl text-sm text-paper/75 sm:text-base">
            Everyone with a confirmed place, from every medical school. Add a short bio and your LinkedIn so people can find you before and after the day.
          </p>
        </div>
      </header>

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
            <NetworkDirectory people={people} me={profile.id} />
          )}
        </>
      )}
    </div>
  );
}
