import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · INSPIRE admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["editor"], "/admin");
  return (
    <div className="min-h-screen bg-paper pb-24 pt-24">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 sm:px-6 lg:grid-cols-[14rem_1fr] lg:gap-10 lg:px-8">
        <AdminNav role={profile.role} />
        <div id="admin-main" className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
