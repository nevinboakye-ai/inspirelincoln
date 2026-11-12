/** How a delegate is getting to INSPIRE. Asked on My Hub; drivers also give their registration. */
export const TRAVEL_MODES = ["inspire_coach", "external_coach", "train", "car", "local"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const TRAVEL_LABEL: Record<TravelMode, { label: string; hint: string }> = {
  inspire_coach: { label: "INSPIRE-organised coach", hint: "Including coaches arranged by your university's society" },
  external_coach: { label: "Booked coach", hint: "A coach you've booked yourself, such as National Express" },
  train: { label: "Train", hint: "To Lincoln station" },
  car: { label: "Car", hint: "We'll ask for your registration" },
  local: { label: "I live in Lincoln", hint: "Walking, cycling, bus or a lift" },
};

export type TravelAnswer = { mode: TravelMode; carRegistration: string | null; updatedAt: string } | null;

/**
 * A car registration as we store it: capitals, single spaces, letters and
 * numbers only. Returns null when what's left isn't 2 to 10 characters.
 */
export function cleanRegistration(raw: string): string | null {
  const reg = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return reg.replace(/ /g, "").length >= 2 && reg.length <= 10 ? reg : null;
}

export const isTravelMode = (v: unknown): v is TravelMode => typeof v === "string" && (TRAVEL_MODES as readonly string[]).includes(v);
