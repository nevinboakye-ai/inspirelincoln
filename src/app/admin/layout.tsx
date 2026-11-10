import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAccess } from "@/lib/auth";
import { ACCOUNT_TYPE_LABEL } from "@/lib/accounts";

export const metadata: Metadata = {
  title: { default: "Committee dashboard", template: "%s · INSPIRE committee" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAccess("any", "/admin");
  const position = [profile.committeePosition, ACCOUNT_TYPE_LABEL[profile.accountType]].filter(Boolean).join(" · ");
  return (
    <div className="min-h-screen bg-paper pb-28 pt-24 lg:pb-24">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 sm:px-6 lg:grid-cols-[15rem_1fr] lg:gap-10 lg:px-8">
        <AdminNav access={profile.access} name={profile.fullName ?? profile.email} position={profile.access.owner ? [position, "Site owner"].filter(Boolean).join(" · ") : position} />
        <div id="admin-main" className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
