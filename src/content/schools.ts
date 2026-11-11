/**
 * Short, sourced facts about each participating medical school, shown on the
 * About page. Matched to the community list (managed in the dashboard) by name.
 * Only add facts with a source.
 */
export interface SchoolDetails {
  /** The school's full name and university. */
  fullName: string;
  university: string;
  place: string;
  /** The year its first medical students started. */
  since: string;
  summary: string;
  url: string;
  source: string;
}

const SCHOOLS: Record<string, SchoolDetails> = {
  lincoln: {
    fullName: "Lincoln Medical School",
    university: "Universities of Lincoln and Nottingham",
    place: "Brayford Pool Campus, Lincoln",
    since: "2019",
    summary:
      "A partnership between the University of Lincoln and the University of Nottingham. Its first 97 students started in September 2019, studying Nottingham's BMBS Medicine degree in Lincoln.",
    url: "https://www.lincoln.ac.uk/medicalschool/",
    // https://news.lincoln.ac.uk/?p=320
    source: "University of Lincoln, September 2019",
  },
  leicester: {
    fullName: "Leicester Medical School",
    university: "University of Leicester",
    place: "Leicester",
    since: "1975",
    summary:
      "Founded in 1975 with a first class of 50 students, it marked its 50th anniversary in 2025. It now welcomes around 290 new medical students each year.",
    url: "https://le.ac.uk/medicine",
    // https://le.ac.uk/news/2025/november/medical-school-anniversary-50-years-leicester
    source: "University of Leicester, November 2025",
  },
  nottingham: {
    fullName: "School of Medicine",
    university: "University of Nottingham",
    place: "Queen's Medical Centre, Nottingham",
    since: "1970",
    summary:
      "The first new medical school in the UK in the 20th century. Its first 48 students arrived in October 1970.",
    url: "https://www.nottingham.ac.uk/medicine/",
    // https://www.nottingham.ac.uk/mhs/about-us/50-30/50-years-of-medicine/history.aspx
    source: "University of Nottingham",
  },
  "east anglia": {
    fullName: "Norwich Medical School",
    university: "University of East Anglia",
    place: "Norwich",
    since: "2002",
    summary:
      "Opened in 2002 at the University of East Anglia, it works in partnership with the Norfolk and Norwich University Hospital and with regional hospitals and community health providers.",
    url: "https://www.uea.ac.uk/about/norwich-medical-school",
    // https://www.uea.ac.uk/about/norwich-medical-school and https://en.wikipedia.org/wiki/Norwich_Medical_School
    source: "Norwich Medical School",
  },
};

/** Details for a community name such as "Leicester" or "Lincoln Medical School". */
export function schoolDetails(name: string): SchoolDetails | null {
  const n = name.toLowerCase();
  const key = Object.keys(SCHOOLS).find((k) => n.includes(k));
  return key ? SCHOOLS[key] : null;
}
