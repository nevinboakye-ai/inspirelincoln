/**
 * A distinct colour for each workshop, by workshop number, so the six are
 * easy to tell apart. Each has at least 4.5:1 contrast with white, so
 * white badge text on it passes WCAG AA. Other text stays dark ink, never
 * the colour itself.
 */
export const WORKSHOP_COLOURS: Record<number, { solid: string; tint: string; name: string }> = {
  1: { solid: "#2F5FD0", tint: "#EEF3FD", name: "blue" },
  2: { solid: "#C2364A", tint: "#FCEFF1", name: "red" },
  3: { solid: "#0F7F5C", tint: "#EAF6F1", name: "green" },
  4: { solid: "#A35512", tint: "#FBF2E9", name: "amber" },
  5: { solid: "#7048C8", tint: "#F3EFFC", name: "violet" },
  6: { solid: "#0B7A93", tint: "#E9F5F8", name: "teal" },
};

export const workshopColour = (n: number) => WORKSHOP_COLOURS[((n - 1) % 6) + 1]!;
