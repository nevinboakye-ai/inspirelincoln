export type SearchKind = "Page" | "Session" | "Speaker" | "Workshop" | "Resource" | "FAQ" | "Opportunity";

export interface SearchItem {
  id: string;
  kind: SearchKind;
  title: string;
  href: string;
  summary?: string;
  keywords?: string;
}

export interface QuickAnswer {
  id: string;
  question: string;
  answer: string;
  href: string;
  linkLabel: string;
}

export interface SearchIndex {
  items: SearchItem[];
  answers: QuickAnswer[];
}

/** Simple ranked matcher: every query word must appear; title hits rank higher. */
export function searchItems(items: SearchItem[], query: string, limit = 24) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    const hay = `${title} ${item.summary ?? ""} ${item.keywords ?? ""} ${item.kind}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 0;
    for (const w of words) {
      if (title.startsWith(w)) score += 6;
      else if (title.includes(w)) score += 3;
      else score += 1;
    }
    if (item.kind === "Page") score += 1;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}
