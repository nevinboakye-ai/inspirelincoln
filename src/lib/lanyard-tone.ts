/**
 * Lanyard colours, shared by the hub page (rendered on the server) and the
 * Lanyard component (rendered in the browser). Kept out of the "use client"
 * file on purpose: a server page can't call a function exported from one,
 * and doing so crashes My Hub with "This page couldn't load".
 */
export type LanyardTone = "delegate" | "poster" | "oral" | "waitlist" | "guest" | "committee" | "executive";

/** Committee members' cards are gold where everyone else's are navy. */
export const isGoldCard = (roles: { tone: LanyardTone }[]) => roles.some((r) => r.tone === "committee" || r.tone === "executive");
