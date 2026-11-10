import type { Metadata } from "next";
import { PortalNav } from "@/components/portal/portal-nav";
import { requireUser } from "@/lib/auth";
import { getSwitches } from "@/lib/switches";
import { presenterKindOf, rolesLabel, rolesOf } from "@/lib/accounts";

export const metadata: Metadata = { title: "My conference", robots: { index: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/portal");
  // The network stays out of the menu entirely until the owner opens it.
  const showNetwork = profile.access.owner || (await getSwitches()).network_open;
  return (
    <div className="min-h-screen bg-paper pb-28 pt-24 sm:pt-28 lg:pb-24">
      <div className="container-page grid gap-5 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <PortalNav
          name={profile.fullName ?? profile.email}
          typeLabel={rolesLabel(rolesOf(profile.accountType, profile.extraTypes))}
          presenter={Boolean(presenterKindOf(profile))}
          access={profile.access}
          reviewer={profile.siteRole === "reviewer"}
          showNetwork={showNetwork}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
