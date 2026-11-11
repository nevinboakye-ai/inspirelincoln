import { SUPABASE_URL } from "@/lib/supabase/env";

/** University names are matched ignoring capitals and spaces at either end. */
export const uniKey = (name: string | null | undefined) => (name ?? "").trim().toLowerCase();

/** The public link to a logo in the media folder. */
export const logoUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;

/** "University of East Anglia" -> "UEA", "Hull York Medical School" -> "HYMS". */
export function uniInitials(name: string) {
  const words = name.replace(/[^A-Za-z\s'-]/g, " ").split(/\s+/).filter(Boolean);
  const skip = new Set(["of", "the", "and", "at", "for"]);
  const letters = words.filter((w) => !skip.has(w.toLowerCase())).map((w) => w[0]!.toUpperCase());
  return (letters.join("") || name.slice(0, 2).toUpperCase()).slice(0, 4);
}

export type LogoMap = Record<string, string>;
