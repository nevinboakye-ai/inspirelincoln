
import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { setNetworkOpen } from "@/app/portal/actions";
import { requireUser } from "@/lib/auth";
import { signAvatars } from "@/lib/avatar";
import { getLogoMap } from "@/lib/university-logos-server";
import { getSwitches } from "@/lib/switches";
import { Notice } from "@/components/ui/notice";
import {
  NetworkCardForm,
  NetworkDirectory,
  type Delegate,
} from "@/components/portal/network";
import type {
  ManagedPerson,
  ManageRights,
} from "@/components/admin/manage-person";
import { submissionKindsFor } from "@/lib/accounts";

export const metadata: Metadata = {
  title: "Delegate network",
};

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const { profile, db } = await requireUser("/portal/network");

  const owner = profile.access.owner;
  const staff = profile.access.exec || profile.access.owner;

  const open =
    profile.accountStatus === "approved" ||
    profile.siteRole === "admin" ||
    staff;

  // Fetch switches, directory, logos, and messaging contacts concurrently.
  const [switches, { data, error }, logos, { data: contacts }] =
    await Promise.all([
      getSwitches(),

      open
        ? db.rpc("network_directory")
        : Promise.resolve({ data: null, error: null }),

      getLogoMap(),

      open
        ? db.rpc("dm_contacts")
        : Promise.resolve({ data: null }),
    ]);

  // The network remains hidden until enabled by the owner.
  const live = switches.network_open;

  if (!live && !owner) {
    redirect("/portal");
  }

  const people = (data ?? []) as Delegate[];

  // Sign delegate avatar URLs.
  const photos = await signAvatars(
    db,
    people.map((p) => p.avatar_path)
  );

  for (const p of people) {
    p.avatar_url = p.avatar_path
      ? (photos.get(p.avatar_path) ?? null)
      : null;
  }

  // Direct messaging permissions.
  // The database determines which delegates can be messaged.
  const messageable = (
    (contacts ?? []) as { id: string }[]
  ).map((c) => c.id);

  // Committee management permissions.
  const can = (c: keyof typeof profile.access.can) =>
    owner || profile.access.can[c];

  const rights: ManageRights = {
    rename: can("review_accounts"),
    request: can("review_accounts") || can("send_email"),
    remove: can("remove_accounts"),
    accountPage: can("review_accounts"),
    accessPage: owner,
  };

  let manage:
    | {
        rights: ManageRights;
        people: Record<string, ManagedPerson>;
      }
    | undefined;

  if (Object.values(rights).some(Boolean)) {
    // Find roster entries for delegates who have not joined.
    const listed =
      people.some((p) => !p.joined) &&
      can("review_accounts")
        ? (
            (
              await db
                .from("delegate_roster")
                .select("id, email")
            ).data ?? []
          )
        : [];

    const byHash = new Map(
      listed.map((r) => [
        `selected:${createHash("md5")
          .update(r.email)
          .digest("hex")}`,
        r.id as string,
      ])
    );

    const entries: [string, ManagedPerson][] = [];

    for (const p of people) {
      if (p.id === profile.id) continue;

      const kinds = submissionKindsFor(
        p.roles?.length ? p.roles : [p.account_type]
      );

      const presents =
        kinds.length === 2
          ? "both"
          : (kinds[0] ?? null);

      const id = p.joined
        ? p.id
        : byHash.get(p.id);

      if (!id) continue;

      entries.push([
        p.id,
        {
          kind: p.joined ? "account" : "list",
          id,
          name: p.full_name,
          institution: p.institution,
          yearOfStudy: p.year_of_study,
          presents,
        },
      ]);
    }

    manage = {
      rights,
      people: Object.fromEntries(entries),
    };
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-xl bg-midnight p-6 text-paper sm:p-8">
        <img
          src="/brand/crest-white.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-10 -right-6 h-48 w-auto opacity-[0.07]"
        />

        <div className="relative">
          <p className="eyebrow flex items-center gap-2 text-gold">
            <Users aria-hidden className="size-4" />
            Delegate network
          </p>

          <h1 className="mt-3 font-display text-3xl sm:text-4xl">
            Meet who&apos;s coming
          </h1>

          <p className="mt-3 max-w-xl text-sm text-paper/75 sm:text-base">
            Everyone at INSPIRE is a medical student, so this
            is a rare chance to meet people on the same path
            as you from other medical schools. Make friends,
            swap details and stay in touch long after the day.
            Add a short bio and your LinkedIn so people can
            find you.
          </p>
        </div>
      </header>

      {owner && (
        <form
          action={setNetworkOpen}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 px-5 py-4"
        >
          <p className="text-sm text-ink">
            {live ? (
              <>
                <strong>The network is open.</strong>{" "}
                Every confirmed delegate can see it.
              </>
            ) : (
              <>
                <strong>Only you can see this.</strong>{" "}
                It is hidden from everyone else, and not in
                their menu, until you open it.
              </>
            )}
          </p>

          {!live && (
            <input
              type="hidden"
              name="open"
              value="on"
            />
          )}

          <button
            className={
              live
                ? "min-h-11 rounded-[3px] border border-navy/20 bg-white px-4 text-sm font-semibold text-ink"
                : "min-h-11 rounded-[3px] bg-navy px-4 text-sm font-semibold text-paper"
            }
          >
            {live ? "Close it again" : "Open to delegates"}
          </button>
        </form>
      )}

      {!open ? (
        <Notice title="The network opens when your place is confirmed">
          Once the committee confirms your account
          you&apos;ll be able to see other delegates here
          and add your own card.
        </Notice>
      ) : (
        <>
          <section
            className="rounded-xl border border-navy/10 bg-white p-5 sm:p-7"
            aria-labelledby="card-title"
          >
            <h2
              id="card-title"
              className="font-display text-xl text-ink"
            >
              Your card
            </h2>

            <p className="mt-1 text-sm text-slate-700">
              Your name, university and year are shown
              to other confirmed delegates. Everything
              else is up to you.
            </p>

            <div className="mt-5">
              <NetworkCardForm
                profile={{
                  bio: profile.bio,
                  linkedinUrl: profile.linkedinUrl,
                  instagram: profile.instagram,
                  networkShowEmail: profile.networkShowEmail,
                  networkListed: profile.networkListed,
                  email: profile.email,
                }}
              />
            </div>
          </section>

          {error ? (
            <Notice tone="warning">
              The network isn&apos;t available just now.
              Please try again later.
            </Notice>
          ) : (
            <NetworkDirectory
              people={people}
              me={profile.id}
              logos={logos}
              messageable={messageable}
              manage={manage}
            />
          )}
        </>
      )}
    </div>
  );
}
