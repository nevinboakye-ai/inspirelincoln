import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Abstract review", robots: { index: false } };

export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["reviewer", "editor"], "/review");
  return <div className="min-h-screen bg-paper pb-24 pt-28"><div className="container-page">{children}</div></div>;
}
