/**
 * Admin content registry. Each entity describes its table and form fields so
 * one generic list/edit UI and one set of server actions can manage them all.
 * Plain data only: this module is imported by both server and client code.
 */
export type FieldType =
  | "text" | "textarea" | "number" | "boolean" | "select" | "date" | "time"
  | "datetime" | "lines" | "links" | "image" | "url" | "relation" | "speakers"
  /** A map pin: writes the `lat` and `lng` columns together. */
  | "location";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  /** For relation fields: the table and label column to choose from. */
  relation?: { table: string; label: string; editionScoped?: boolean };
  wide?: boolean;
}

export interface EntityDef {
  key: string;
  table: string;
  label: string;
  singular: string;
  description: string;
  /** Rows belong to an edition: new rows get the current edition, lists filter to it. */
  editionScoped?: boolean;
  /** Admin only (otherwise editors may also manage). */
  adminOnly?: boolean;
  titleField: string;
  listColumns: string[];
  orderBy: { column: string; ascending?: boolean }[];
  fields: FieldDef[];
  /** Public paths to refresh after a change. */
  revalidate: string[];
}

const opts = (...v: [string, string][]) => v.map(([value, label]) => ({ value, label }));
const SESSION_CATEGORIES = opts(["keynote", "Keynote"], ["research", "Research presentations"], ["workshop", "Workshop"], ["networking", "Networking"], ["break", "Break"], ["closing", "Closing"]);
const published: FieldDef = { name: "published", label: "Published (visible on the public site)", type: "boolean" };
const sort: FieldDef = { name: "sort", label: "Sort order", type: "number", hint: "Lower numbers appear first." };

export const ENTITIES: EntityDef[] = [
  {
    key: "sessions", table: "sessions", label: "Programme sessions", singular: "session", editionScoped: true,
    description: "Agenda items. Leave times empty until they are confirmed; untimed sessions are shown as provisional.",
    titleField: "title", listColumns: ["category", "starts_at", "is_provisional", "published"], orderBy: [{ column: "sort" }, { column: "starts_at" }],
    revalidate: ["/", "/programme", "/today", "/conference"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "text", required: true, hint: "Lowercase letters, numbers and hyphens." },
      { name: "category", label: "Category", type: "select", required: true, options: SESSION_CATEGORIES },
      { name: "starts_at", label: "Starts (UK time)", type: "datetime" },
      { name: "ends_at", label: "Ends (UK time)", type: "datetime" },
      { name: "room_id", label: "Room", type: "relation", relation: { table: "rooms", label: "name", editionScoped: true } },
      { name: "workshop_id", label: "Linked workshop", type: "relation", relation: { table: "workshops", label: "title", editionScoped: true } },
      { name: "speakers", label: "Speakers", type: "speakers", wide: true },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "objectives", label: "Learning objectives", type: "lines", hint: "One per line.", wide: true },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "is_provisional", label: "Provisional (show a 'to be confirmed' label)", type: "boolean" },
      published, sort,
    ],
  },
  {
    key: "speakers", table: "speakers", label: "Speakers", singular: "speaker",
    description: "Only add confirmed speakers. Unpublished speakers are hidden from the public site.",
    titleField: "full_name", listColumns: ["institution", "session_type", "published"], orderBy: [{ column: "sort" }, { column: "full_name" }],
    revalidate: ["/", "/speakers", "/programme"],
    fields: [
      { name: "full_name", label: "Full name", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", required: true },
      { name: "credentials", label: "Credentials", type: "text", hint: "e.g. MBChB, PhD" },
      { name: "position", label: "Position", type: "text" },
      { name: "institution", label: "Institution", type: "text" },
      { name: "specialty", label: "Specialty", type: "text" },
      { name: "session_type", label: "Session type", type: "select", options: SESSION_CATEGORIES },
      { name: "portrait_url", label: "Portrait", type: "image" },
      { name: "bio", label: "Biography", type: "textarea", wide: true },
      { name: "research_interests", label: "Research interests", type: "lines", hint: "One per line." },
      { name: "links", label: "Links", type: "links", hint: "One per line as Label | https://…" },
      published, sort,
    ],
  },
  {
    key: "workshops", table: "workshops", label: "Workshops", singular: "workshop", editionScoped: true,
    description: "The conference's workshop series.",
    titleField: "title", listColumns: ["number", "facilitator", "published"], orderBy: [{ column: "number" }],
    revalidate: ["/", "/workshops", "/programme"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "text", required: true },
      { name: "number", label: "Workshop number", type: "number", required: true },
      { name: "strapline", label: "Strapline", type: "text", wide: true },
      { name: "summary", label: "Summary", type: "textarea", wide: true },
      { name: "description", label: "Full description", type: "textarea", wide: true },
      { name: "topics", label: "Topics covered", type: "lines" },
      { name: "outcomes", label: "Learning outcomes", type: "lines" },
      { name: "audience", label: "Who it's for", type: "text", wide: true },
      { name: "facilitator", label: "Facilitator", type: "text", hint: "Leave empty until confirmed." },
      { name: "facilitator_bio", label: "Facilitator biography", type: "textarea" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "booking_enabled", label: "Booking enabled", type: "boolean" },
      { name: "accent", label: "Accent colour", type: "select", options: opts(["electric", "Electric blue"], ["cyan", "Cyan"], ["violet", "Violet"]) },
      { name: "motif", label: "Illustration", type: "select", options: opts(["manuscript", "Manuscript"], ["pulse", "Pulse"], ["evidence", "Evidence"], ["portfolio", "Portfolio"], ["simulation", "Simulation"], ["globe", "Globe"]) },
      { name: "notes", label: "Practical notes", type: "textarea" },
      published,
    ],
  },
  {
    key: "rooms", table: "rooms", label: "Rooms", singular: "room", editionScoped: true,
    description: "Venue rooms used by programme sessions.",
    titleField: "name", listColumns: ["building", "capacity"], orderBy: [{ column: "sort" }],
    revalidate: ["/programme", "/conference"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "building", label: "Building", type: "text" },
      { name: "floor", label: "Floor", type: "text" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "directions", label: "Directions", type: "textarea", wide: true },
      sort,
    ],
  },
  {
    key: "announcements", table: "announcements", label: "Announcements", singular: "announcement", editionScoped: true,
    description: "Pinned important or urgent public announcements appear in the site-wide ribbon.",
    titleField: "title", listColumns: ["level", "audience", "pinned", "published"], orderBy: [{ column: "published_at", ascending: false }],
    revalidate: ["/", "/conference", "/today"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "body", label: "Message", type: "textarea", wide: true },
      { name: "level", label: "Level", type: "select", options: opts(["info", "Information"], ["important", "Important"], ["urgent", "Urgent"]) },
      { name: "audience", label: "Audience", type: "select", options: opts(["public", "Everyone"], ["delegates", "Signed-in delegates"], ["presenters", "Presenters only"]) },
      { name: "published_at", label: "Publish from (UK time)", type: "datetime" },
      { name: "expires_at", label: "Expires (UK time)", type: "datetime" },
      { name: "pinned", label: "Pinned", type: "boolean" },
      published,
    ],
  },
  {
    key: "faqs", table: "faqs", label: "FAQs", singular: "FAQ", editionScoped: true,
    description: "Frequently asked questions on the conference page.",
    titleField: "question", listColumns: ["category", "published"], orderBy: [{ column: "sort" }],
    revalidate: ["/conference"],
    fields: [
      { name: "question", label: "Question", type: "text", required: true, wide: true },
      { name: "answer", label: "Answer", type: "textarea", required: true, wide: true },
      { name: "category", label: "Category", type: "text" },
      published, sort,
    ],
  },
  {
    key: "opportunities", table: "opportunities", label: "Opportunities", singular: "opportunity",
    description: "Research and career opportunities. Mark illustrative entries as examples.",
    titleField: "title", listColumns: ["category", "deadline", "is_example", "published"], orderBy: [{ column: "created_at", ascending: false }],
    revalidate: ["/opportunities"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "slug", label: "URL slug", type: "text", required: true },
      { name: "category", label: "Category", type: "text", required: true, hint: "e.g. Research project, Elective, Audit, Funding" },
      { name: "organisation", label: "Organisation", type: "text" },
      { name: "deadline", label: "Deadline", type: "date" },
      { name: "url", label: "Link", type: "url" },
      { name: "summary", label: "Summary", type: "textarea", wide: true },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "eligibility", label: "Eligibility", type: "textarea", wide: true },
      { name: "is_example", label: "This is an illustrative example (labelled on the site)", type: "boolean" },
      published,
    ],
  },
  {
    key: "gallery", table: "gallery_assets", label: "Gallery", singular: "image",
    description: "Only publish images you have permission to use. Alt text is required for accessibility.",
    titleField: "caption", listColumns: ["year", "downloadable", "published"], orderBy: [{ column: "year", ascending: false }, { column: "sort" }],
    revalidate: ["/gallery"],
    fields: [
      { name: "url", label: "Image", type: "image", required: true, wide: true },
      { name: "alt", label: "Alt text", type: "text", required: true, wide: true, hint: "Describe the image for people who can't see it." },
      { name: "caption", label: "Caption", type: "text", wide: true },
      { name: "year", label: "Year", type: "number", required: true },
      { name: "width", label: "Width (px)", type: "number" },
      { name: "height", label: "Height (px)", type: "number" },
      { name: "credit", label: "Credit", type: "text" },
      { name: "downloadable", label: "Allow download", type: "boolean" },
      published, sort,
    ],
  },
  {
    key: "partners", table: "partners", label: "Institutions & partners", singular: "partner",
    description: "Describe the relationship accurately. Do not imply endorsement that hasn't been given.",
    titleField: "name", listColumns: ["relationship", "published"], orderBy: [{ column: "sort" }],
    revalidate: ["/", "/about"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "relationship", label: "Relationship", type: "text", required: true, hint: "e.g. 2026 host medical school" },
      { name: "url", label: "Website", type: "url" },
      { name: "logo_url", label: "Logo", type: "image", hint: "Only with permission." },
      published, sort,
    ],
  },
  {
    key: "sponsors", table: "sponsors", label: "Sponsors", singular: "sponsor",
    description: "Sponsors are listed on the Sponsors page, along the foot of every page and on the home page. Lower sort numbers come first. A PNG logo with a transparent background looks best.",
    titleField: "name", listColumns: ["contribution", "show_on_card", "published"], orderBy: [{ column: "sort" }, { column: "name" }],
    revalidate: ["/", "/sponsors", "/portal"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, wide: true },
      { name: "contribution", label: "What they've given", type: "text", wide: true, hint: "One line, e.g. 2 × 12-month Clinical Skills Plan subscriptions." },
      { name: "description", label: "About them", type: "textarea", wide: true, hint: "A sentence or two for the Sponsors page." },
      { name: "url", label: "Website", type: "url" },
      { name: "logo_url", label: "Logo", type: "image", hint: "Until a logo is added, the sponsor's name is shown instead." },
      { name: "show_on_card", label: "Show on the back of Delegate Cards", type: "boolean" },
      published, sort,
    ],
  },
  {
    key: "committee", table: "committee_members", label: "Committee", singular: "committee member",
    description: "The organising committee directory on the About page.",
    titleField: "name", listColumns: ["role", "institution", "published"], orderBy: [{ column: "sort" }],
    revalidate: ["/about"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "text", required: true },
      { name: "institution", label: "Institution", type: "text" },
      { name: "photo_url", label: "Photo", type: "image" },
      { name: "bio", label: "Biography", type: "textarea", wide: true },
      { name: "links", label: "Links", type: "links", hint: "One per line as Label | https://…" },
      published, sort,
    ],
  },
  {
    key: "map", table: "map_places", label: "Map places", singular: "map place",
    description: "Places on the campus map at /map. Only pin a place once you know exactly where it is; unpinned places are listed as \"location to be confirmed\". Link a place to a room to show that room's sessions on the map.",
    titleField: "name", listColumns: ["kind", "code", "lat", "location_confirmed", "published"], orderBy: [{ column: "sort" }, { column: "name" }],
    revalidate: ["/map", "/today"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "text", required: true, hint: "Used in links such as /map?place=inb." },
      { name: "code", label: "Building or room code", type: "text", hint: "e.g. INB or LMS005" },
      { name: "kind", label: "Type", type: "select", required: true, options: opts(["venue", "Conference venue"], ["room", "Room or spot inside a building"], ["building", "Other campus building"], ["landmark", "Landmark"], ["amenity", "Facility (toilets, food, parking)"]) },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "location", label: "Location on the map", type: "location", wide: true, hint: "Click the map or drag the pin. Rooms can be left unpinned to use their building's pin." },
      { name: "parent_id", label: "Inside building", type: "relation", relation: { table: "map_places", label: "name" } },
      { name: "room_id", label: "Programme room", type: "relation", relation: { table: "rooms", label: "name", editionScoped: true }, hint: "Sessions in this room are listed for this place." },
      { name: "directions", label: "Directions on the day", type: "textarea", wide: true },
      { name: "location_confirmed", label: "Location confirmed for the conference", type: "boolean" },
      published, sort,
    ],
  },
  {
    key: "timeline", table: "timeline_events", label: "History timeline", singular: "milestone",
    description: "Only verified milestones are shown publicly.",
    titleField: "title", listColumns: ["year", "verified", "published"], orderBy: [{ column: "sort" }],
    revalidate: ["/about"],
    fields: [
      { name: "year", label: "Year", type: "text", required: true },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", wide: true },
      { name: "verified", label: "Verified (required to appear publicly)", type: "boolean" },
      published, sort,
    ],
  },
  {
    key: "resources", table: "resources", label: "Resources", singular: "resource",
    description: "Research resources linked from the Research hub and delegate portal.",
    titleField: "title", listColumns: ["category", "published"], orderBy: [{ column: "sort" }],
    revalidate: ["/research", "/portal"],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, wide: true },
      { name: "category", label: "Category", type: "text", required: true },
      { name: "url", label: "Link", type: "url" },
      { name: "summary", label: "Summary", type: "textarea", wide: true },
      { name: "is_example", label: "Illustrative example", type: "boolean" },
      published, sort,
    ],
  },
  {
    key: "criteria", table: "review_criteria", label: "Review criteria", singular: "criterion", editionScoped: true, adminOnly: true,
    description: "The rubric reviewers score each abstract against.",
    titleField: "label", listColumns: ["max_score", "weight"], orderBy: [{ column: "sort" }],
    revalidate: [],
    fields: [
      { name: "label", label: "Criterion", type: "text", required: true },
      { name: "description", label: "Guidance for reviewers", type: "textarea", wide: true },
      { name: "max_score", label: "Maximum score", type: "number", required: true },
      { name: "weight", label: "Weight", type: "number", required: true, hint: "Relative importance, e.g. 1 or 1.5." },
      sort,
    ],
  },
  {
    key: "editions", table: "editions", label: "Editions & archive", singular: "edition", adminOnly: true,
    description: "Each conference year. Past editions appear in the archive. Use Conference settings to edit the current edition in detail.",
    titleField: "name", listColumns: ["year", "event_date", "is_current", "published"], orderBy: [{ column: "year", ascending: false }],
    revalidate: ["/", "/archive", "/conference"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "year", label: "Year", type: "number", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "theme", label: "Theme", type: "text", required: true, wide: true },
      { name: "event_date", label: "Date", type: "date", required: true },
      { name: "venue_name", label: "Venue", type: "text", required: true },
      { name: "host_institution", label: "Host institution", type: "text" },
      { name: "highlights", label: "Archive highlights", type: "textarea", wide: true, hint: "Only verified facts." },
      published,
    ],
  },
];

export const getEntity = (key: string) => ENTITIES.find((e) => e.key === key);
