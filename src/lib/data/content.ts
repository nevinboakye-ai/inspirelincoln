import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import * as seed from "@/content/seed";
import type {
  AbstractConfig,
  Announcement,
  CommitteeMember,
  Edition,
  Faq,
  GalleryAsset,
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

/**
 * Public content repository. Reads published content from Supabase with the
 * anonymous key (RLS applies) and falls back to the bundled seed content when
 * Supabase is not configured. Pages using these functions are statically
 * generated and revalidated (see `revalidate` exports on each page).
 */

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

function logError(scope: string, error: unknown) {
  console.error(`[content] ${scope}:`, error);
}

const defaultAbstractConfig = seed.seedEdition.abstractConfig;

export function mapEdition(r: Row): Edition {
  const cfg = (r.abstract_config ?? {}) as Partial<AbstractConfig>;
  return {
    id: String(r.id),
    year: Number(r.year),
    slug: String(r.slug),
    name: String(r.name),
    theme: String(r.theme),
    themeStatement: String(r.theme_statement ?? ""),
    date: String(r.event_date),
    startTime: r.start_time ? String(r.start_time).slice(0, 5) : null,
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : null,
    timezone: String(r.timezone ?? "Europe/London"),
    venueName: String(r.venue_name),
    venueInstitution: String(r.venue_institution ?? ""),
    venueAddress: String(r.venue_address ?? ""),
    venueNotes: str(r.venue_notes),
    expectedAttendance: r.expected_attendance == null ? null : Number(r.expected_attendance),
    status: (r.status as Edition["status"]) ?? null,
    registrationUrl: str(r.registration_url),
    registrationNote: str(r.registration_note),
    eventDayMode: Boolean(r.event_day_mode),
    postEventMode: Boolean(r.post_event_mode),
    isCurrent: Boolean(r.is_current),
    highlights: str(r.highlights),
    hostInstitution: str(r.host_institution),
    posterDeadline: str(r.poster_deadline),
    posterRequirements: arr(r.poster_requirements),
    abstractConfig: { ...defaultAbstractConfig, ...cfg },
  };
}

function mapSession(r: Row): Session {
  const speakers = (r.session_speakers as { speaker_id: string }[] | undefined) ?? [];
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    category: r.category as Session["category"],
    startsAt: str(r.starts_at),
    endsAt: str(r.ends_at),
    roomId: str(r.room_id),
    description: String(r.description ?? ""),
    objectives: arr(r.objectives),
    capacity: r.capacity == null ? null : Number(r.capacity),
    workshopId: str(r.workshop_id),
    speakerIds: speakers.map((s) => s.speaker_id),
    isProvisional: Boolean(r.is_provisional),
    sort: Number(r.sort ?? 0),
  };
}

export function mapSpeaker(r: Row): Speaker {
  return {
    id: String(r.id),
    slug: String(r.slug),
    fullName: String(r.full_name),
    credentials: str(r.credentials),
    position: str(r.position),
    institution: str(r.institution),
    specialty: str(r.specialty),
    sessionType: (r.session_type as Speaker["sessionType"]) ?? null,
    bio: str(r.bio),
    researchInterests: arr(r.research_interests),
    portraitUrl: str(r.portrait_url),
    links: Array.isArray(r.links) ? (r.links as Speaker["links"]) : [],
  };
}

function mapWorkshop(r: Row): Workshop {
  return {
    id: String(r.id),
    slug: String(r.slug),
    number: Number(r.number),
    title: String(r.title),
    strapline: String(r.strapline ?? ""),
    summary: String(r.summary ?? ""),
    description: String(r.description ?? ""),
    topics: arr(r.topics),
    outcomes: arr(r.outcomes),
    audience: String(r.audience ?? ""),
    facilitator: str(r.facilitator),
    facilitatorBio: str(r.facilitator_bio),
    capacity: r.capacity == null ? null : Number(r.capacity),
    bookingEnabled: Boolean(r.booking_enabled),
    accent: (r.accent as Workshop["accent"]) ?? "electric",
    motif: (r.motif as Workshop["motif"]) ?? "pulse",
    notes: str(r.notes),
  };
}

export const getEdition = cache(async (): Promise<Edition> => {
  const db = createPublicClient();
  if (!db) return seed.seedEdition;
  const { data, error } = await db.from("editions").select("*").eq("is_current", true).maybeSingle();
  if (error) logError("edition", error);
  return data ? mapEdition(data) : seed.seedEdition;
});

export const getArchiveEditions = cache(async (): Promise<Edition[]> => {
  const db = createPublicClient();
  if (!db) return [seed.seedEdition];
  const { data, error } = await db.from("editions").select("*").order("year", { ascending: false });
  if (error) logError("archive", error);
  return (data ?? []).map(mapEdition);
});

export const getRooms = cache(async (): Promise<Room[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedRooms;
  const edition = await getEdition();
  const { data, error } = await db.from("rooms").select("*").eq("edition_id", edition.id).order("sort");
  if (error) logError("rooms", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    building: str(r.building),
    floor: str(r.floor),
    directions: str(r.directions),
    capacity: r.capacity == null ? null : Number(r.capacity),
  }));
});

export const getSessions = cache(async (): Promise<Session[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedSessions;
  const edition = await getEdition();
  const { data, error } = await db
    .from("sessions")
    .select("*, session_speakers(speaker_id)")
    .eq("edition_id", edition.id)
    .eq("published", true)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("sort");
  if (error) logError("sessions", error);
  return (data ?? []).map(mapSession);
});

export const getSpeakers = cache(async (): Promise<Speaker[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedSpeakers;
  const { data, error } = await db.from("speakers").select("*").eq("published", true).order("sort").order("full_name");
  if (error) logError("speakers", error);
  return (data ?? []).map(mapSpeaker);
});

export const getWorkshops = cache(async (): Promise<Workshop[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedWorkshops;
  const edition = await getEdition();
  const { data, error } = await db
    .from("workshops")
    .select("*")
    .eq("edition_id", edition.id)
    .eq("published", true)
    .order("number");
  if (error) logError("workshops", error);
  return (data ?? []).map(mapWorkshop);
});

export const getAnnouncements = cache(async (): Promise<Announcement[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedAnnouncements;
  const { data, error } = await db
    .from("announcements")
    .select("*")
    .eq("published", true)
    .eq("audience", "public")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(10);
  if (error) logError("announcements", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    body: String(r.body ?? ""),
    level: r.level,
    audience: r.audience,
    pinned: Boolean(r.pinned),
    publishedAt: String(r.published_at),
  }));
});

export const getFaqs = cache(async (): Promise<Faq[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedFaqs;
  const { data, error } = await db.from("faqs").select("*").eq("published", true).order("sort");
  if (error) logError("faqs", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    question: String(r.question),
    answer: String(r.answer),
    category: String(r.category),
  }));
});

export const getOpportunities = cache(async (): Promise<Opportunity[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedOpportunities;
  const { data, error } = await db
    .from("opportunities")
    .select("*")
    .eq("published", true)
    .order("deadline", { ascending: true, nullsFirst: false });
  if (error) logError("opportunities", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    category: String(r.category),
    organisation: str(r.organisation),
    summary: String(r.summary ?? ""),
    description: String(r.description ?? ""),
    eligibility: str(r.eligibility),
    deadline: str(r.deadline),
    url: str(r.url),
    isExample: Boolean(r.is_example),
  }));
});

export const getGallery = cache(async (): Promise<GalleryAsset[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedGallery;
  const { data, error } = await db
    .from("gallery_assets")
    .select("*")
    .eq("published", true)
    .order("year", { ascending: false })
    .order("sort");
  if (error) logError("gallery", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    year: Number(r.year),
    kind: r.kind,
    url: String(r.url),
    thumbnailUrl: str(r.thumbnail_url),
    caption: String(r.caption ?? ""),
    alt: String(r.alt ?? ""),
    width: Number(r.width),
    height: Number(r.height),
    downloadable: Boolean(r.downloadable),
    credit: str(r.credit),
  }));
});

export const getPartners = cache(async (): Promise<Partner[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedPartners;
  const { data, error } = await db.from("partners").select("*").eq("published", true).order("sort");
  if (error) logError("partners", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    logoUrl: str(r.logo_url),
    url: str(r.url),
    relationship: String(r.relationship),
  }));
});

export const getCommittee = cache(async (): Promise<CommitteeMember[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedCommittee;
  const { data, error } = await db.from("committee_members").select("*").eq("published", true).order("sort");
  if (error) logError("committee", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    role: String(r.role),
    institution: str(r.institution),
    bio: str(r.bio),
    photoUrl: str(r.photo_url),
    links: Array.isArray(r.links) ? r.links : [],
  }));
});

export const getTimeline = cache(async (): Promise<TimelineEvent[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedTimeline;
  const { data, error } = await db
    .from("timeline_events")
    .select("*")
    .eq("published", true)
    .eq("verified", true)
    .order("sort");
  if (error) logError("timeline", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    year: String(r.year),
    title: String(r.title),
    description: String(r.description ?? ""),
  }));
});

export const getResources = cache(async (): Promise<Resource[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedResources;
  const { data, error } = await db.from("resources").select("*").eq("published", true).order("sort");
  if (error) logError("resources", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    category: String(r.category),
    summary: String(r.summary ?? ""),
    url: str(r.url),
    isExample: Boolean(r.is_example),
  }));
});

export const getShowcase = cache(async (): Promise<ShowcaseItem[]> => {
  const db = createPublicClient();
  if (!db) return seed.seedShowcase;
  const { data, error } = await db.from("showcase_abstracts").select("*").order("year", { ascending: false });
  if (error) logError("showcase", error);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    authors: [r.presenting_author, r.co_authors].filter(Boolean).join(", "),
    university: String(r.university),
    category: String(r.category),
    summary: String(r.summary ?? ""),
    year: Number(r.year),
  }));
});

/** Everything the programme, conference and event-day views need, in one call. */
export const getConferenceBundle = cache(async () => {
  const [edition, sessions, speakers, workshops, rooms, announcements] = await Promise.all([
    getEdition(),
    getSessions(),
    getSpeakers(),
    getWorkshops(),
    getRooms(),
    getAnnouncements(),
  ]);
  return { edition, sessions, speakers, workshops, rooms, announcements };
});
