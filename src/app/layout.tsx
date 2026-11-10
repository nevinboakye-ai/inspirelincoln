import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { EditShortcut } from "@/components/layout/edit-shortcut";
import { ViewAsBanner } from "@/components/layout/view-as-banner";
import { ScrollProgress } from "@/components/motion/effects";
import { SiteFooter } from "@/components/layout/site-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getAnnouncements, getEdition, getSiteOpen } from "@/lib/data/content";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});
const body = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | INSPIRE 2026`,
    template: `%s | INSPIRE`,
  },
  description:
    "INSPIRE brings together the next generation of clinicians, researchers and innovators. INSPIRE 2026: Digital Health: From Innovation to Evidence, Saturday 21 November 2026 at Lincoln Medical School.",
  applicationName: "INSPIRE",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0c182c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [edition, announcements, siteOpen] = await Promise.all([getEdition(), getAnnouncements(), getSiteOpen()]);
  const ribbon = announcements.find((a) => a.pinned && a.level !== "info") ?? null;
  return (
    <html lang="en-GB" className={`${display.variable} ${body.variable}`}>
      <body>
        <a
          href="#main"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-sm bg-cyan px-4 py-3 font-semibold text-midnight transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <Providers>
          <ScrollProgress />
          <SiteHeader edition={{ year: edition.year, date: edition.date }} ribbon={ribbon} siteOpen={siteOpen} />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <SiteFooter edition={edition} siteOpen={siteOpen} />
          <EditShortcut />
          <Suspense fallback={null}>
            <ViewAsBanner />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
