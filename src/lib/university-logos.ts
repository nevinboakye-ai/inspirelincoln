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

/**
 * Logos taken from each university's own website (November 2026), cropped to
 * the emblem so they read at small sizes. A logo the committee uploads on
 * the University logos page replaces the one here.
 *
 *   University of Lincoln       www.lincoln.ac.uk (site icon, shown white on its navy)
 *   University of East Anglia   www.uea.ac.uk (header logo)
 *   University of Nottingham    www.nottingham.ac.uk (UoN-Logo-Light.svg)
 *   University of Leeds         www.leeds.ac.uk (footer logo)
 *   Hull York Medical School    www.hyms.ac.uk (hyms-logo.svg)
 *   Keele University            www.keele.ac.uk (header logo.svg)
 *   King's College London       www.kcl.ac.uk (kcl-logo.svg)
 */
const BUILT_IN_FILES: Record<string, string[]> = {
  "university-of-lincoln": ["university of lincoln", "uol lincoln"],
  "university-of-east-anglia": ["university of east anglia", "uea", "university of east anglia (uea)", "uea norwich"],
  "university-of-nottingham": ["university of nottingham", "nottingham university"],
  "university-of-leeds": ["university of leeds", "leeds university"],
  "hull-york-medical-school": ["hull york medical school", "hyms", "hull york medical school (hyms)"],
  "keele-university": ["keele university", "keele"],
  "kings-college-london": ["king's college london", "king’s college london", "kings college london", "kcl"],
};

/** Built-in logos keyed by uniKey(name), including common ways of writing each name. */
export const BUILT_IN_LOGOS: LogoMap = Object.fromEntries(
  Object.entries(BUILT_IN_FILES).flatMap(([file, names]) => names.map((n) => [n, `/universities/${file}.svg`])),
);
