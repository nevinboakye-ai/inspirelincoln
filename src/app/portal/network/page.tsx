import type { Metadata } from "next";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { setNetworkOpen } from "@/app/portal/actions";
import { requireUser } from "@/lib/auth";
import { signAvatars } from "@/lib/avatar";
import { getLogoMap } from "@/lib/university-logos-server";
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
  // Hidden entirely from everyone but the owner until it is opened.
  if (!live && !owner) redirect("/portal");
  const staff = profile.access.exec || profile.access.owner;
  const open = profile.accountStatus === "approved" || profile.siteRole === "admin" || staff;
  const { data, error } = open ? await db.rpc("network_directory") : { data: null, error: null };
  const people = (data ?? []) as Delegate[];
  const [photos, logos] = await Promise.all([signAvatars(db, people.map((p) => p.avatar_path)), getLogoMap()]);
  for (const p of people) p.avatar_url = p.avatar_path ? (photos.get(p.avatar_path) ?? null) : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img src="/brand/crest-white.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]" />
        <div className="relative">
          <p className="eyebrow flex items-center gap-2 text-gold"><Users aria-hidden className="size-4" /> Delegate network</p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl">Meet who&apos;s coming</h1>
          <p className="mt-3 max-w-xl text-sm text-paper/75 sm:text-base">
            Everyone at INSPIRE is a medical student, so this is a rare chance to meet people on the same path as you from other medical schools. Make friends, swap details and stay in touch long after the day. Add a short bio and your LinkedIn so people can find you.
          </p>
        </div>
      </header>

      {owner && (
        <form action={setNetworkOpen} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 px-5 py-4">
          <p className="text-sm text-ink">
            {live ? (
              <><strong>The network is open.</strong> Every confirmed delegate can see it.</>
            ) : (
              <><strong>Only you can see this.</strong> It is hidden from everyone else, and not in their menu, until you open it.</>
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
              <NetworkCardForm profile={{ bio: profile.bio, linkedinUrl: profile.linkedinUrl, instagram: profile.instagram, networkShowEmail: profile.networkShowEmail, networkListed: profile.networkListed, email: profile.email }} />
            </div>
          </section>

          {error ? (
            <Notice tone="warning">The network isn&apos;t available just now. Please try again later.</Notice>
          ) : (
            <NetworkDirectory people={people} me={profile.id} logos={logos} />
          )}
        </>
      )}
    </div>
  );
}

