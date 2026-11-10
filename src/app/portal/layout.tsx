import type { Metadata } from "next";
import { PortalNav } from "@/components/portal/portal-nav";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My Conference", robots: { index: false } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/portal");
  return (
    <div className="min-h-screen bg-paper pb-24 pt-28">
      <div className="container-page grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-12">
        <PortalNav role={profile.role} name={profile.fullName ?? profile.email} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
