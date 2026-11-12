export const SITE_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return "https://inspirelincoln.uk";
  }
})();
export const SITE_NAME = "INSPIRE National Medical Research Conference";
export const SITE_SHORT = "INSPIRE";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? null;

export const SOCIAL_LINKS: { label: string; url: string }[] = [
  // Add official accounts here once confirmed, e.g. { label: "Instagram", url: "https://..." }
];

export interface NavItem {
  label: string;
  href: string;
}

/** The whole public site, kept deliberately short. */
export const NAV: NavItem[] = [
  { label: "Programme", href: "/programme" },
  { label: "Campus map", href: "/map" },
  { label: "Speakers", href: "/speakers" },
  { label: "Venue & FAQs", href: "/conference" },
  { label: "Sponsors", href: "/sponsors" },
  { label: "About", href: "/about" },
];

export const FOOTER_LINKS = {
  explore: [
    { label: "Programme", href: "/programme" },
    { label: "On the day", href: "/today" },
    { label: "Campus map", href: "/map" },
    { label: "Speakers", href: "/speakers" },
    { label: "Workshops", href: "/workshops" },
    { label: "Sponsors", href: "/sponsors" },
  ],
  participate: [
    { label: "Log in", href: "/login" },
    { label: "Register", href: "/signup" },
    { label: "Venue & FAQs", href: "/conference" },
    { label: "About INSPIRE", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy notice", href: "/privacy" },
    { label: "Cookies", href: "/cookies" },
    { label: "Accessibility", href: "/accessibility" },
    { label: "Terms", href: "/terms" },
  ],
};
