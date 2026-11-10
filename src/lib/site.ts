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
  description?: string;
}
export interface NavGroup {
  label: string;
  href?: string;
  items: NavItem[];
  feature?: { title: string; body: string; href: string; cta: string };
}

export const NAV: NavGroup[] = [
  {
    label: "INSPIRE",
    items: [
      { label: "About INSPIRE", href: "/about", description: "Our story, mission, values and committee" },
      { label: "Opportunities", href: "/opportunities", description: "Research, mentorship and learning beyond the conference" },
      { label: "Gallery & archive", href: "/gallery", description: "Photographs and past conferences" },
    ],
    feature: {
      title: "More than a conference",
      body: "A community helping medical students take their first steps into research.",
      href: "/about",
      cta: "Our mission",
    },
  },
  {
    label: "Conference 2026",
    items: [
      { label: "Conference 2026", href: "/conference", description: "Theme, venue, travel, accessibility and FAQs" },
      { label: "Programme", href: "/programme", description: "The interactive schedule and your agenda" },
      { label: "Speakers", href: "/speakers", description: "Keynotes and session leads" },
      { label: "Workshops", href: "/workshops", description: "Six clinician-led, interactive workshops" },
    ],
    feature: {
      title: "Digital Health: From Innovation to Evidence",
      body: "Saturday 21 November 2026 at Lincoln Medical School.",
      href: "/conference",
      cta: "Explore the conference",
    },
  },
  {
    label: "Research",
    items: [
      { label: "Research & Abstracts", href: "/research", description: "Submissions, guidance and requirements" },
      { label: "Presenter guidance", href: "/research#presenters", description: "Poster deadlines and requirements" },
      { label: "Research showcase", href: "/research/showcase", description: "Approved student research" },
      { label: "Resources", href: "/research#resources", description: "Abstract writing, appraisal and posters" },
    ],
  },
];

export const FOOTER_LINKS = {
  explore: [
    { label: "Home", href: "/" },
    { label: "About INSPIRE", href: "/about" },
    { label: "Conference 2026", href: "/conference" },
    { label: "Programme", href: "/programme" },
    { label: "Speakers", href: "/speakers" },
  ],
  participate: [
    { label: "Workshops", href: "/workshops" },
    { label: "Research & Abstracts", href: "/research" },
    { label: "Opportunities", href: "/opportunities" },
    { label: "Gallery", href: "/gallery" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy policy", href: "/privacy" },
    { label: "Cookie policy", href: "/cookies" },
    { label: "Accessibility statement", href: "/accessibility" },
    { label: "Terms of use", href: "/terms" },
  ],
};
