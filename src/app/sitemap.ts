import type { MetadataRoute } from "next";
import { getArchiveEditions, getOpportunities, getSpeakers, getWorkshops } from "@/lib/data/content";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [speakers, workshops, opportunities, editions] = await Promise.all([getSpeakers(), getWorkshops(), getOpportunities(), getArchiveEditions()]);
  const now = new Date();
  const pages = ["", "/about", "/conference", "/programme", "/speakers", "/workshops", "/research", "/research/showcase", "/opportunities", "/gallery", "/contact", "/today", "/map", "/privacy", "/cookies", "/accessibility", "/terms"];
  return [
    ...pages.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...speakers.map((s) => ({ url: `${SITE_URL}/speakers/${s.slug}`, lastModified: now })),
    ...workshops.map((w) => ({ url: `${SITE_URL}/workshops/${w.slug}`, lastModified: now })),
    ...opportunities.map((o) => ({ url: `${SITE_URL}/opportunities/${o.slug}`, lastModified: now })),
    ...editions.filter((e) => !e.isCurrent).map((e) => ({ url: `${SITE_URL}/archive/${e.year}`, lastModified: now })),
  ];
}
