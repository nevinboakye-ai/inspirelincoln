/**
 * Domain types shared by the public site, the portal and the admin dashboard.
 * Field names mirror the Supabase schema in supabase/migrations (snake_case in
 * the database, mapped to camelCase in src/lib/data).
 */

export type ConferenceStatus =
  | "registration_soon"
  | "registration_open"
  | "registration_closed"
  | "underway"
  | "concluded";

export const CONFERENCE_STATUS_LABEL: Record<ConferenceStatus, string> = {
  registration_soon: "Registration opening soon",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  underway: "Conference underway",
  concluded: "Conference concluded",
};

export interface Edition {
  id: string;
  year: number;
  slug: string;
  name: string;
  theme: string;
  themeStatement: string;
  /** ISO date (yyyy-mm-dd) in Europe/London. */
  date: string;
  /** "HH:MM" local UK time, or null until the organisers confirm it. */
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  venueName: string;
  venueInstitution: string;
  venueAddress: string;
  venueNotes: string | null;
  expectedAttendance: number | null;
  /** Set by administrators. Null until the team chooses a status. */
  status: ConferenceStatus | null;
  registrationUrl: string | null;
  registrationNote: string | null;
  eventDayMode: boolean;
  postEventMode: boolean;
  isCurrent: boolean;
  highlights: string | null;
  hostInstitution: string | null;
  posterDeadline: string | null;
  posterRequirements: string[];
  abstractConfig: AbstractConfig;
}

export interface AbstractConfig {
  submissionsOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  sectionWordLimit: number;
  totalWordLimit: number;
  categories: string[];
  presentationTypes: string[];
  allowFiles: boolean;
  maxFileMb: number;
  eligibility: string[];
  formatting: string[];
}

export type SessionCategory =
  | "keynote"
  | "research"
  | "workshop"
  | "networking"
  | "break"
  | "closing";

export const SESSION_CATEGORY_LABEL: Record<SessionCategory, string> = {
  keynote: "Keynote",
  research: "Research Presentation",
  workshop: "Workshop",
  networking: "Networking",
  break: "Break",
  closing: "Closing Session",
};

export interface Room {
  id: string;
  name: string;
  building: string | null;
  floor: string | null;
  directions: string | null;
  capacity: number | null;
}

export interface Session {
  id: string;
  slug: string;
  title: string;
  category: SessionCategory;
  /** ISO timestamp with offset, or null while provisional. */
  startsAt: string | null;
  endsAt: string | null;
  roomId: string | null;
  description: string;
  objectives: string[];
  capacity: number | null;
  workshopId: string | null;
  speakerIds: string[];
  isProvisional: boolean;
  /** Display order while times are unconfirmed. */
  sort: number;
}

export interface Speaker {
  id: string;
  slug: string;
  fullName: string;
  credentials: string | null;
  position: string | null;
  institution: string | null;
  specialty: string | null;
  sessionType: SessionCategory | null;
  bio: string | null;
  researchInterests: string[];
  portraitUrl: string | null;
  links: { label: string; url: string }[];
}

export interface Workshop {
  id: string;
  slug: string;
  number: number;
  title: string;
  strapline: string;
  summary: string;
  description: string;
  topics: string[];
  outcomes: string[];
  audience: string;
  facilitator: string | null;
  facilitatorBio: string | null;
  capacity: number | null;
  bookingEnabled: boolean;
  accent: "electric" | "cyan" | "violet";
  motif: "manuscript" | "pulse" | "evidence" | "portfolio" | "simulation" | "globe";
  notes: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: "info" | "important" | "urgent";
  audience: "public" | "delegates" | "presenters";
  pinned: boolean;
  publishedAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface Opportunity {
  id: string;
  slug: string;
  title: string;
  category: string;
  organisation: string | null;
  summary: string;
  description: string;
  eligibility: string | null;
  deadline: string | null;
  url: string | null;
  isExample: boolean;
}

export interface GalleryAsset {
  id: string;
  year: number;
  kind: "image" | "video";
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  alt: string;
  width: number;
  height: number;
  downloadable: boolean;
  credit: string | null;
}

export interface Partner {
  id: string;
  name: string;
  logoUrl: string | null;
  url: string | null;
  relationship: string;
}

export interface CommitteeMember {
  id: string;
  name: string;
  role: string;
  institution: string | null;
  bio: string | null;
  photoUrl: string | null;
  links: { label: string; url: string }[];
}

export interface TimelineEvent {
  id: string;
  year: string;
  title: string;
  description: string;
}

export interface Resource {
  id: string;
  title: string;
  category: string;
  summary: string;
  url: string | null;
  isExample: boolean;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  authors: string;
  university: string;
  category: string;
  summary: string;
  year: number;
}

export interface SiteContent {
  edition: Edition;
  rooms: Room[];
  sessions: Session[];
  speakers: Speaker[];
  workshops: Workshop[];
  announcements: Announcement[];
  faqs: Faq[];
}

export type UserRole = "delegate" | "reviewer" | "editor" | "admin";

export type AccountType =
  | "delegate"
  | "oral_presenter"
  | "poster_presenter"
  | "oral_waitlist"
  | "supporting_committee"
  | "academic_team"
  | "publicity_team"
  | "finance_team"
  | "logistics_team"
  | "executive_committee"
  | "vice_president"
  | "president";
export type AccountStatus = "pending" | "approved" | "waitlisted" | "declined";
export type SubmissionKind = "slides" | "poster";
export type SubmissionStatus = "submitted" | "changes_requested" | "approved";

export type MapPlaceKind = "venue" | "room" | "building" | "landmark" | "amenity";

export interface MapPlace {
  id: string;
  slug: string;
  name: string;
  code: string | null;
  kind: MapPlaceKind;
  description: string;
  /** Null until a verified location is set in the admin dashboard. */
  lat: number | null;
  lng: number | null;
  parentId: string | null;
  roomId: string | null;
  directions: string | null;
  /** Whether the location of this place for the conference is confirmed. */
  locationConfirmed: boolean;
}
