import type { Metadata } from "next";
import { PortalNav } from "@/components/portal/portal-nav";
import { requireUser } from "@/lib/auth";
import { ACCOUNT_TYPE_LABEL, submissionKindFor } from "@/lib/accounts";

export const metadata: Metadata = { title: "My conference", robots: { index: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/portal");
  return (
    <div className="min-h-screen bg-paper pb-28 pt-24 sm:pt-28 lg:pb-24">
      <div className="container-page grid gap-5 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <PortalNav
          name={profile.fullName ?? profile.email}
          typeLabel={ACCOUNT_TYPE_LABEL[profile.accountType]}
          presenter={Boolean(submissionKindFor(profile.accountType))}
          access={profile.access}
          reviewer={profile.siteRole === "reviewer"}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
