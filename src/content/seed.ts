/**
 * Fallback content used when Supabase is not configured, and the source of
 * supabase/seed.sql. Everything here is either taken from the organisers' brief
 * or explicitly marked as provisional / example content. Nothing in this file
 * should present an unconfirmed detail as fact.
 */
import type {
  Announcement,
  CommitteeMember,
  Edition,
  Faq,
  GalleryAsset,
  MapPlace,
  Opportunity,
  Partner,
  Resource,
  Room,
  Session,
  ShowcaseItem,
  Speaker,
  TimelineEvent,
  Workshop,
} from "@/lib/types";

export const seedEdition: Edition = {
  id: "edition-2026",
  year: 2026,
  slug: "2026",
  name: "INSPIRE 2026",
  theme: "Digital Health: From Innovation to Evidence",
  themeStatement:
    "Exploring how emerging technologies are transforming healthcare, and the evidence needed to translate innovation into meaningful clinical impact.",
  date: "2026-11-21",
  startTime: "08:00",
  endTime: "15:50",
  timezone: "Europe/London",
  venueName: "Lincoln Medical School",
  venueInstitution: "University of Lincoln",
  venueAddress: "University of Lincoln, Brayford Pool, Lincoln LN6 7TS",
  venueNotes: null,
  expectedAttendance: 250,
  status: null,
  registrationUrl: null,
  registrationNote:
    "Registration details are published by the conference team. If you have already registered, bring your confirmation with you on the day.",
  eventDayMode: false,
  postEventMode: false,
  isCurrent: true,
  highlights: null,
  hostInstitution: "Lincoln Medical School, University of Lincoln",
  posterDeadline: "2026-11-13",
  posterRequirements: [
    "Accepted poster presenters should submit their poster by Friday 13 November 2026.",
    "Posters may be landscape or portrait.",
    "Bring a printed copy of your poster to the conference.",
  ],
  abstractConfig: {
    submissionsOpen: false,
    opensAt: null,
    closesAt: null,
    sectionWordLimit: 150,
    totalWordLimit: 300,
    categories: [
      "Digital health and technology",
      "Clinical research",
      "Medical education",
      "Public health and inequalities",
      "Surgery and simulation",
      "Laboratory and translational science",
      "Quality improvement and audit",
    ],
    presentationTypes: ["Poster presentation", "Oral presentation"],
    allowFiles: true,
    maxFileMb: 10,
    eligibility: [
      "The presenting author is a medical student or early-career researcher.",
      "The work has not been misrepresented and all co-authors have agreed to submission.",
    ],
    formatting: [
      "Structure your abstract as Background, Aim, Methods, Results and Conclusion.",
      "Do not include identifiable patient information.",
      "Use standard abbreviations, written out in full at first use.",
    ],
  },
};

/** Rooms are placeholders until the venue confirms allocations. */
export const seedRooms: Room[] = [
  {
    id: "room-main",
    name: "Main lecture theatre (to be confirmed)",
    building: "Isaac Newton Building (INB)",
    floor: null,
    directions: "Signage and volunteers will direct you on arrival.",
    capacity: null,
  },
  {
    id: "room-lms005",
    name: "LMS005",
    building: "Ross Lucas Medical Sciences Building (Lincoln Medical School)",
    floor: null,
    directions: null,
    capacity: null,
  },
  {
    id: "room-inb",
    name: "Isaac Newton Building (room to be confirmed)",
    building: "Isaac Newton Building (INB)",
    floor: null,
    directions: null,
    capacity: null,
  },
];

/** Times are UK local (GMT in November, so UTC+0). */
const at = (hhmm: string) => `2026-11-21T${hhmm}:00Z`;
const session = (
  sort: number,
  slug: string,
  title: string,
  category: Session["category"],
  start: string,
  end: string,
  description: string,
  extra: Partial<Session> = {},
): Session => ({
  id: `s-${slug}`,
  slug,
  title,
  category,
  startsAt: at(start),
  endsAt: at(end),
  roomId: null,
  description,
  objectives: [],
  capacity: null,
  workshopId: null,
  speakerIds: [],
  isProvisional: false,
  sort,
  ...extra,
});

/**
 * The confirmed timetable for 21 November 2026. Speakers, rooms and which
 * workshops run in each workshop session are added in the admin dashboard
 * once confirmed.
 */
export const seedSessions: Session[] = [
  session(10, "breakfast", "Breakfast", "break", "08:00", "09:00", "Arrive, collect your badge and have breakfast with fellow delegates before the day begins."),
  session(20, "welcome-and-housekeeping", "Welcome and housekeeping", "keynote", "09:00", "09:15", "An introduction to INSPIRE 2026, this year's theme and the shape of the day.", { roomId: "room-main" }),
  session(30, "keynote-1", "Keynote speaker 1", "keynote", "09:15", "09:45", "The first keynote of the day. The speaker will be announced soon.", { roomId: "room-main" }),
  session(40, "refreshment-break", "Refreshment break", "break", "09:45", "10:00", "A short break for refreshments."),
  session(50, "keynote-2", "Keynote speaker 2", "keynote", "10:00", "10:30", "The second keynote of the day. The speaker will be announced soon.", { roomId: "room-main" }),
  session(60, "oral-presentations-inb", "Oral presentations: Isaac Newton Building", "research", "10:30", "11:30", "Five selected delegates present their research, with time for questions. Runs at the same time as the LMS005 stream.", { roomId: "room-inb" }),
  session(65, "oral-presentations-lms005", "Oral presentations: LMS005", "research", "10:30", "11:30", "Four selected delegates present their research, with time for questions. Runs at the same time as the Isaac Newton Building stream, with one fewer talk to allow for the walk between buildings.", { roomId: "room-lms005" }),
  session(70, "lunch-and-posters", "Lunch and poster presentations", "research", "11:30", "12:45", "Lunch alongside the poster exhibition. Presenters stand with their posters to discuss their work with delegates and judges."),
  session(80, "workshop-session-1", "Workshop session 1", "workshop", "12:45", "13:30", "The first of three workshop sessions. Which workshops run in this session will be confirmed before the day."),
  session(90, "workshop-session-2", "Workshop session 2", "workshop", "13:30", "14:15", "The second of three workshop sessions. Which workshops run in this session will be confirmed before the day."),
  session(100, "afternoon-break", "Break", "break", "14:15", "14:40", "Time to stretch, grab a drink and move to your next workshop."),
  session(110, "workshop-session-3", "Workshop session 3", "workshop", "14:40", "15:25", "The third of three workshop sessions. Which workshops run in this session will be confirmed before the day."),
  session(120, "closing-and-prizes", "Closing and prizes", "closing", "15:25", "15:50", "Prizes for the best oral and poster presentations, closing remarks and thanks.", { roomId: "room-main" }),
];

/** No speakers have been supplied yet. The UI shows labelled placeholders. */
export const seedSpeakers: Speaker[] = [];

export const seedWorkshops: Workshop[] = [
  {
    id: "w1",
    slug: "from-writing-to-publishing",
    number: 1,
    title: "From Writing to Publishing",
    strapline: "Turn research into a publication.",
    summary:
      "Explore the process of transforming research into academic publications.",
    description:
      "This workshop follows a piece of research from first draft to published paper. It looks at how manuscripts are structured, how to choose a journal that fits your work, what happens during peer review and how to respond to reviewers, and how to plan a realistic publication strategy as a student.",
    topics: ["Manuscript structure", "Journal selection", "Peer review", "Publication strategy"],
    outcomes: [
      "Describe the standard structure of a research manuscript",
      "Weigh up factors when choosing a target journal",
      "Understand how peer review works and how to respond to reviewer comments",
      "Plan next steps for publishing your own work",
    ],
    audience: "Students with a project in progress or completed, and anyone considering their first publication.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "electric",
    motif: "manuscript",
    notes: null,
  },
  {
    id: "w2",
    slug: "digital-health-in-clinical-practice",
    number: 2,
    title: "Digital Health in Clinical Practice",
    strapline: "Cases, data and decisions.",
    summary:
      "Interactive clinical cases exploring the application of digital tools, data and evidence-based decision-making.",
    description:
      "Working through interactive clinical cases, participants will consider where digital tools and data can support clinical decisions, what evidence should be expected before a tool is adopted, and where the limits and risks lie.",
    topics: ["Clinical cases", "Digital tools", "Data in decision-making", "Evaluating evidence"],
    outcomes: [
      "Discuss how digital tools can inform clinical decisions",
      "Identify the evidence needed before adopting a digital intervention",
      "Recognise risks, limitations and unintended consequences",
    ],
    audience: "All delegates. No prior technical knowledge is needed.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "cyan",
    motif: "pulse",
    notes: null,
  },
  {
    id: "w3",
    slug: "evidence-based-medicine-in-practice",
    number: 3,
    title: "Evidence-Based Medicine in Practice",
    strapline: "Read critically. Decide well.",
    summary:
      "Develop critical appraisal skills and understand how evidence informs clinical decisions.",
    description:
      "A practical introduction to critical appraisal. Participants will work through published research, assess its validity and relevance, and discuss how evidence is weighed alongside clinical judgement and patient preferences.",
    topics: ["Critical appraisal", "Study design", "Bias and validity", "Applying evidence"],
    outcomes: [
      "Apply a structured approach to appraising a research paper",
      "Recognise common sources of bias",
      "Explain how evidence informs, but does not replace, clinical judgement",
    ],
    audience: "Students at any stage who want to read research with more confidence.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "violet",
    motif: "evidence",
    notes: null,
  },
  {
    id: "w4",
    slug: "building-a-competitive-clinical-portfolio",
    number: 4,
    title: "Building a Competitive Clinical Portfolio",
    strapline: "Document what you have done. Plan what comes next.",
    summary:
      "Explore practical approaches to documenting achievements, identifying opportunities and developing an academic or clinical portfolio.",
    description:
      "This workshop looks at how to build a portfolio that reflects your interests and achievements. It covers documenting activity as you go, finding meaningful opportunities in research, teaching and leadership, and presenting your experience clearly.",
    topics: ["Recording achievements", "Finding opportunities", "Academic portfolios", "Reflection"],
    outcomes: [
      "Set up a simple system for recording achievements",
      "Identify opportunities that match your interests",
      "Present your experience clearly and honestly",
    ],
    audience: "Students in any year, particularly those thinking about foundation and specialty applications.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "electric",
    motif: "portfolio",
    notes: null,
  },
  {
    id: "w5",
    slug: "digital-surgery-and-simulation",
    number: 5,
    title: "Digital Surgery and Simulation",
    strapline: "Where surgical training meets technology.",
    summary:
      "Explore how digital technologies, simulation and emerging surgical tools may influence surgical education and practice.",
    description:
      "An exploration of how simulation and digital technologies are being used in surgical education and practice, and what evidence exists for their benefits. Any hands-on demonstrations or equipment will be announced once confirmed by the facilitators.",
    topics: ["Simulation-based education", "Emerging surgical technology", "Skills assessment", "Evidence for new tools"],
    outcomes: [
      "Describe how simulation is used in surgical training",
      "Discuss the potential and limitations of emerging surgical technologies",
      "Consider how the impact of new surgical tools can be evaluated",
    ],
    audience: "Students with an interest in surgery, simulation or medical technology.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "cyan",
    motif: "simulation",
    notes: "Interactive demonstrations will be listed here if confirmed.",
  },
  {
    id: "w6",
    slug: "global-digital-health-inequalities",
    number: 6,
    title: "Global Digital Health Inequalities",
    strapline: "Who benefits from digital health, and who is left behind?",
    summary:
      "Explore how access, infrastructure, socioeconomic factors and healthcare systems influence the adoption and impact of digital healthcare technologies.",
    description:
      "Digital health can widen or narrow inequalities. This workshop examines how access, connectivity, digital literacy, socioeconomic factors and the design of healthcare systems shape who benefits from new technology, in the UK and globally.",
    topics: ["Digital exclusion", "Infrastructure and access", "Health systems", "Equitable design"],
    outcomes: [
      "Identify factors that influence access to digital healthcare",
      "Discuss how digital interventions can widen or reduce inequalities",
      "Consider principles for more equitable digital health",
    ],
    audience: "All delegates, especially those interested in public and global health.",
    facilitator: null,
    facilitatorBio: null,
    capacity: null,
    bookingEnabled: false,
    accent: "violet",
    motif: "globe",
    notes: null,
  },
];

export const seedAnnouncements: Announcement[] = [
  {
    id: "a-poster-deadline",
    title: "Poster submission deadline: Friday 13 November",
    body: "Accepted poster presenters should submit their posters by Friday 13 November 2026 and bring a printed copy on the day. Landscape and portrait are both accepted.",
    level: "important",
    audience: "public",
    pinned: true,
    publishedAt: "2026-11-09T09:00:00Z",
  },
];

export const seedFaqs: Faq[] = [
  {
    id: "f1",
    question: "When and where is INSPIRE 2026?",
    answer:
      "Saturday 21 November 2026 at Lincoln Medical School, University of Lincoln. Session times will be published on the programme page once confirmed.",
    category: "Conference",
  },
  {
    id: "f2",
    question: "Who is the conference for?",
    answer:
      "Medical students, aspiring clinician-researchers, early-career researchers, academic clinicians and healthcare innovators. You do not need research experience to attend.",
    category: "Conference",
  },
  {
    id: "f3",
    question: "How do I register?",
    answer:
      "Registration details are published on the Conference 2026 page. The current registration status is always shown there.",
    category: "Registration",
  },
  {
    id: "f4",
    question: "What do poster presenters need to do?",
    answer:
      "Accepted presenters should submit their poster by Friday 13 November 2026 and bring a printed copy to the conference. Landscape and portrait orientations are both accepted.",
    category: "Research",
  },
  {
    id: "f5",
    question: "Do I need to choose workshops in advance?",
    answer:
      "Workshop allocation details will be confirmed by the conference team. You can explore all six workshops now and save the ones you are interested in to your agenda.",
    category: "Workshops",
  },
  {
    id: "f6",
    question: "I have an access requirement. Who should I contact?",
    answer:
      "Please contact the team using the accessibility enquiry option on the contact page as early as possible, so arrangements can be made before the day.",
    category: "Accessibility",
  },
];

/** No opportunities have been supplied. The hub shows an empty state. */
export const seedOpportunities: Opportunity[] = [];

/** No approved media has been supplied. The gallery shows an empty state. */
export const seedGallery: GalleryAsset[] = [];

/**
 * Participating medical school community as described by the organisers.
 * Relationship labels describe student participation only, not endorsement.
 */
export const seedPartners: Partner[] = [
  { id: "p-lincoln", name: "Lincoln Medical School", logoUrl: null, url: null, relationship: "2026 host medical school" },
  { id: "p-leicester", name: "Leicester", logoUrl: null, url: null, relationship: "Participating student community" },
  { id: "p-nottingham", name: "Nottingham", logoUrl: null, url: null, relationship: "Participating student community" },
  { id: "p-east-anglia", name: "East Anglia", logoUrl: null, url: null, relationship: "Participating student community" },
];

/** Committee profiles are added through the admin dashboard. */
export const seedCommittee: CommitteeMember[] = [
  { id: "c-nadhisha", name: "Nadhisha", role: "President", institution: null, bio: null, photoUrl: "/committee/nadhisha.webp", links: [] },
  { id: "c-nevin", name: "Nevin", role: "Vice-President", institution: null, bio: null, photoUrl: "/committee/nevin.webp", links: [] },
  { id: "c-abeeraam", name: "Abeeraam", role: "Treasurer", institution: null, bio: null, photoUrl: "/committee/abeeraam.webp", links: [] },
  { id: "c-faiza", name: "Faiza", role: "Education Secretary", institution: null, bio: null, photoUrl: "/committee/faiza.webp", links: [] },
  { id: "c-haneen", name: "Haneen", role: "Operations Secretary", institution: null, bio: null, photoUrl: "/committee/haneen.webp", links: [] },
];

/** Only verified milestones are listed. Earlier history is added once verified. */
export const seedTimeline: TimelineEvent[] = [
  {
    id: "t-2026",
    year: "2026",
    title: "INSPIRE comes to Lincoln",
    description:
      "The 2026 conference, Digital Health: From Innovation to Evidence, is hosted at Lincoln Medical School in collaboration with the participating medical school community.",
  },
];

/** Reputable, freely available external resources. Links point to the publishers. */
export const seedResources: Resource[] = [
  {
    id: "r-equator",
    title: "EQUATOR Network reporting guidelines",
    category: "Writing & reporting",
    summary: "The central library of reporting guidelines such as CONSORT, STROBE and PRISMA, useful when structuring an abstract or manuscript.",
    url: "https://www.equator-network.org/",
    isExample: false,
  },
  {
    id: "r-casp",
    title: "CASP critical appraisal checklists",
    category: "Critical appraisal",
    summary: "Structured checklists for appraising randomised trials, cohort studies, systematic reviews and more.",
    url: "https://casp-uk.net/casp-tools-checklists/",
    isExample: false,
  },
  {
    id: "r-cochrane",
    title: "Cochrane Handbook for Systematic Reviews of Interventions",
    category: "Research methods",
    summary: "The standard reference for planning and conducting systematic reviews.",
    url: "https://training.cochrane.org/handbook",
    isExample: false,
  },
  {
    id: "r-nihr",
    title: "NIHR Academy",
    category: "Research careers",
    summary: "Information on research training and career pathways supported by the National Institute for Health and Care Research.",
    url: "https://www.nihr.ac.uk/career-development",
    isExample: false,
  },
];

/** Approved, consented research is published here by administrators. */
export const seedShowcase: ShowcaseItem[] = [];

/**
 * Campus map places. Coordinates are only included where they come from a
 * published source (OpenStreetMap data, or Wikipedia for The Engine Shed and
 * Lincoln Performing Arts Centre). Everything else is listed without a pin until
 * the team sets its location in Admin, Map places.
 */
export const seedMapPlaces: MapPlace[] = [
  {
    id: "place-inb",
    slug: "inb",
    name: "Isaac Newton Building",
    code: "INB",
    kind: "venue",
    description: "The main INSPIRE venue: registration, the main lecture theatre and the first group of oral presentations (five speakers). Rooms will be confirmed.",
    lat: 53.226757,
    lng: -0.548265,
    parentId: null,
    roomId: "room-inb",
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-lms",
    slug: "lms",
    name: "Ross Lucas Medical Sciences Building",
    code: "LMS",
    kind: "venue",
    description: "Home of Lincoln Medical School. The second group of oral presentations is in LMS005.",
    lat: null,
    lng: null,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-registration",
    slug: "registration",
    name: "Registration and breakfast",
    code: null,
    kind: "room",
    description: "Check in here when you arrive. The exact spot will be confirmed.",
    lat: null,
    lng: null,
    parentId: "place-inb",
    roomId: null,
    directions: "Follow the INSPIRE signs and volunteers on arrival.",
    locationConfirmed: false,
  },
  {
    id: "place-main-theatre",
    slug: "main-theatre",
    name: "Main lecture theatre",
    code: null,
    kind: "room",
    description: "Welcome, keynotes and closing. The room will be confirmed.",
    lat: null,
    lng: null,
    parentId: "place-inb",
    roomId: "room-main",
    directions: null,
    locationConfirmed: false,
  },
  {
    id: "place-lms005",
    slug: "lms005",
    name: "LMS005",
    code: "LMS005",
    kind: "room",
    description: "Oral presentations, second group (four speakers).",
    lat: null,
    lng: null,
    parentId: "place-lms",
    roomId: "room-lms005",
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-minerva",
    slug: "minerva",
    name: "Minerva Building",
    code: "MB",
    kind: "building",
    description: "The University's main administration building, beside Brayford Pool.",
    lat: 53.228584,
    lng: -0.5478345,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-bridge-house",
    slug: "bridge-house",
    name: "Bridge House",
    code: "BH",
    kind: "building",
    description: "University building on the north-west side of campus.",
    lat: 53.229755,
    lng: -0.55056095,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-sarah-swift",
    slug: "sarah-swift",
    name: "Sarah Swift Building",
    code: "SSB",
    kind: "building",
    description: "Academic building on the east side of campus.",
    lat: 53.226868,
    lng: -0.5437877,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-joseph-banks",
    slug: "joseph-banks",
    name: "Joseph Banks Laboratories",
    code: "JBL",
    kind: "building",
    description: "Science laboratories on the west side of campus.",
    lat: 53.227118,
    lng: -0.555257,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-engine-shed",
    slug: "engine-shed",
    name: "The Engine Shed",
    code: null,
    kind: "landmark",
    description: "The University's live music and events venue, a useful landmark at the east end of campus.",
    lat: 53.22726,
    lng: -0.54529,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-lpac",
    slug: "performing-arts-centre",
    name: "Lincoln Performing Arts Centre",
    code: "PA",
    kind: "landmark",
    description: "Theatre and performance venue on campus.",
    lat: 53.228889,
    lng: -0.549444,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  // Around town: where most delegates arrive, and the city's best-known sight.
  {
    id: "place-lincoln-station",
    slug: "lincoln-station",
    name: "Lincoln Central railway station",
    code: "RAIL",
    kind: "landmark",
    description:
      "Lincoln's railway station, in the city centre. Trains run from London King's Cross (direct, or change at Newark), Nottingham and Sheffield. Campus is under 10 minutes away on foot.",
    lat: 53.226006,
    lng: -0.53991,
    parentId: null,
    roomId: null,
    directions: "Leave by the main entrance on St Mary's Street and head west towards the Brayford Pool waterfront.",
    locationConfirmed: true,
  },
  {
    id: "place-lincoln-bus-station",
    slug: "lincoln-bus-station",
    name: "Lincoln Central bus station",
    code: "BUS",
    kind: "landmark",
    description: "The city's main bus station, beside the railway station. Local and regional buses and coaches stop here. Campus is about 10 minutes away on foot.",
    lat: 53.2273,
    lng: -0.5375,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
  {
    id: "place-lincoln-cathedral",
    slug: "lincoln-cathedral",
    name: "Lincoln Cathedral",
    code: "CATH",
    kind: "landmark",
    description:
      "Lincoln's medieval cathedral, at the top of the hill in the old city. About 25 minutes from campus on foot, the last part up Steep Hill. Worth a visit if you have time before or after the conference.",
    lat: 53.2344,
    lng: -0.5361,
    parentId: null,
    roomId: null,
    directions: null,
    locationConfirmed: true,
  },
];
