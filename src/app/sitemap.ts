import type { MetadataRoute } from "next";
import { getSpeakers, getWorkshops } from "@/lib/data/content";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [speakers, workshops] = await Promise.all([getSpeakers(), getWorkshops()]);
  const now = new Date();
  const pages = ["", "/programme", "/map", "/speakers", "/conference", "/about", "/workshops", "/today", "/signup", "/contact", "/privacy", "/cookies", "/accessibility", "/terms"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...speakers.map((s) => ({ url: `${SITE_URL}/speakers/${s.slug}`, lastModified: now })),
    ...workshops.map((w) => ({ url: `${SITE_URL}/workshops/${w.slug}`, lastModified: now })),
  ];
}
