import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACCOUNT_STATUS_LABEL, COMMITTEE_TYPES, SUBMISSION_LABEL, SUBMISSION_STATUS_LABEL, rolesLabel, rolesOf, type Access, type Capability } from "@/lib/accounts";
import { loadAttendance } from "@/lib/admin/attendance";
import { loadTravel } from "@/lib/admin/travel";
import { TRAVEL_LABEL } from "@/lib/travel";
import { loadAllocationBoard } from "@/lib/workshops/admin";
import { universityName } from "@/lib/university-logos";
import { SESSION_CATEGORY_LABEL, type AccountStatus, type AccountType, type SessionCategory, type SubmissionKind, type SubmissionStatus } from "@/lib/types";
import { ukDateTime, ukTime, type Column, type ExportTable, type Row } from "./table";

export type DatasetSection = "People" | "Presenters" | "Travel" | "Workshops" | "On the day" | "Records";
export const SECTIONS: DatasetSection[] = ["People", "Presenters", "Travel", "Workshops", "On the day", "Records"];

export type Dataset = {
  key: string;
  title: string;
  /** One line for the downloads page and the cover sheet. */
  description: string;
  section: DatasetSection;
  /** Any one of these is enough. Empty means anyone with a committee dashboard. */
  need: Capability[];
  /** Has a University column, so it can be cut down to one university. */
  byUniversity: boolean;
  load: (ctx: LoadContext) => Promise<ExportTable>;
};

export type LoadContext = { db: SupabaseClient; userId: string; cache: Map<string, Promise<unknown>> };

const ATTENDING: AccountType[] = ["delegate", "oral_presenter", "poster_presenter", "oral_waitlist"];

/** The same data asked for twice in one download (the university pack) is only fetched once. */
function once<T>(ctx: LoadContext, key: string, f: () => Promise<T>): Promise<T> {
  if (!ctx.cache.has(key)) ctx.cache.set(key, f());
  return ctx.cache.get(key) as Promise<T>;
}

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  institution: string | null;
  programme: string | null;
  year_of_study: string | null;
  account_type: AccountType;
  extra_types?: AccountType[] | null;
  account_status: AccountStatus;
  committee_position: string | null;
  presentation_title: string | null;
  dietary_requirements: string | null;
  accessibility_needs: string | null;
  photo_opt_out: boolean | null;
  created_at: string;
};
type RosterRow = { id: string; email: string; full_name: string; institution: string | null; year_of_study: string | null; account_type: AccountType; extra_types?: AccountType[] | null; presentation_title: string | null; note: string | null };

const people = (ctx: LoadContext) =>
  once(ctx, "people", async () => {
    const [{ data: profiles }, { data: roster }] = await Promise.all([
      ctx.db.from("profiles").select("*").limit(5000),
      ctx.db.from("delegate_roster").select("*").limit(5000),
    ]);
    const all = (profiles ?? []) as ProfileRow[];
    const emails = new Set(all.map((p) => p.email.toLowerCase()));
    return {
      profiles: all,
      /** Selected-list entries who haven't set up their account yet. */
      notJoined: ((roster ?? []) as RosterRow[]).filter((r) => !emails.has(r.email.toLowerCase())),
    };
  });

/** When each person was checked in, by user id. Empty when the reader can't see registrations. */
const checkIns = (ctx: LoadContext) =>
  once(ctx, "checkins", async () => {
    const { data: ed } = await ctx.db.from("editions").select("id").eq("is_current", true).maybeSingle();
    const { data } = await ctx.db.from("registrations").select("user_id, status, checked_in_at").eq("edition_id", ed?.id ?? "").limit(5000);
    return new Map((data ?? []).map((r) => [r.user_id as string, { status: r.status as string, at: (r.checked_in_at as string | null) ?? null }]));
  });

const board = (ctx: LoadContext) => once(ctx, "board", () => loadAllocationBoard(ctx.db, ctx.userId));
const attendance = (ctx: LoadContext) => once(ctx, "attendance", () => loadAttendance(ctx.db));
const travel = (ctx: LoadContext) => once(ctx, "travel", () => loadTravel(ctx.db));

const name = (p: { full_name: string | null; email: string }) => p.full_name?.trim() || p.email;
const uni = (s: string | null | undefined) => universityName(s);
const byName = (a: Row, b: Row) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "en-GB");

// Columns used across several downloads.
const C = {
  name: { key: "name", label: "Name", width: 26 },
  email: { key: "email", label: "Email", width: 32, personal: true },
  university: { key: "university", label: "University", width: 28 },
  year: { key: "year", label: "Year of study", width: 14 },
  programme: { key: "programme", label: "Course", width: 24, wordHidden: true },
  roles: { key: "roles", label: "Role", width: 24 },
} satisfies Record<string, Column>;

export const DATASETS: Dataset[] = [
  {
    key: "attendees",
    title: "Delegate list",
    description: "Everyone attending as a delegate or presenter, including people on the selected list who haven't set up their account yet.",
    section: "People",
    need: ["review_accounts", "manage_people"],
    byUniversity: true,
    async load(ctx) {
      const [{ profiles, notJoined }, checked] = await Promise.all([people(ctx), checkIns(ctx)]);
      // Committee members who also present are included; the rest are on the committee list.
      const attending = (t: AccountType, x?: AccountType[] | null) => rolesOf(t, x).some((r) => ATTENDING.includes(r));
      const rows: Row[] = [
        ...profiles
          .filter((p) => p.account_status === "approved" && attending(p.account_type, p.extra_types))
          .map((p) => ({
            name: name(p),
            email: p.email,
            university: uni(p.institution),
            year: p.year_of_study ?? "",
            programme: p.programme ?? "",
            roles: rolesLabel(rolesOf(p.account_type, p.extra_types)),
            presenting: p.presentation_title ?? "",
            account: "Set up",
            checked_in: checked.get(p.id)?.at ? ukTime(checked.get(p.id)!.at) : "",
          })),
        ...notJoined
          .filter((r) => attending(r.account_type, r.extra_types))
          .map((r) => ({
            name: r.full_name,
            email: r.email,
            university: uni(r.institution),
            year: r.year_of_study ?? "",
            programme: "",
            roles: rolesLabel(rolesOf(r.account_type, r.extra_types)),
            presenting: r.presentation_title ?? "",
            account: "Not set up yet",
            checked_in: "",
          })),
      ].sort(byName);
      return {
        title: this.title,
        description: this.description,
        groupBy: "university",
        columns: [C.name, C.email, C.university, C.year, C.programme, C.roles, { key: "presenting", label: "Presenting", width: 36 }, { key: "account", label: "Account", width: 14 }, { key: "checked_in", label: "Checked in", width: 12 }],
        rows,
      };
    },
  },
  {
    key: "committee",
    title: "Committee list",
    description: "The executive and supporting committee, with their teams and positions.",
    section: "People",
    need: ["review_accounts"],
    byUniversity: true,
    async load(ctx) {
      const { profiles, notJoined } = await people(ctx);
      const isCommittee = (t: AccountType, x?: AccountType[] | null) => rolesOf(t, x).some((r) => COMMITTEE_TYPES.includes(r));
      const rows: Row[] = [
        ...profiles
          .filter((p) => p.account_status === "approved" && isCommittee(p.account_type, p.extra_types))
          .map((p) => ({ name: name(p), email: p.email, university: uni(p.institution), roles: rolesLabel(rolesOf(p.account_type, p.extra_types)), position: p.committee_position ?? "", account: "Set up" })),
        ...notJoined
          .filter((r) => isCommittee(r.account_type, r.extra_types))
          .map((r) => ({ name: r.full_name, email: r.email, university: uni(r.institution), roles: rolesLabel(rolesOf(r.account_type, r.extra_types)), position: "", account: "Not set up yet" })),
      ].sort(byName);
      return {
        title: this.title,
        description: this.description,
        columns: [C.name, C.email, C.university, { ...C.roles, width: 36 }, { key: "position", label: "Position", width: 28 }, { key: "account", label: "Account", width: 14 }],
        rows,
      };
    },
  },
  {
    key: "accounts",
    title: "All accounts",
    description: "Every account on the website with its status (approved, waiting for review, waitlisted or not approved).",
    section: "People",
    need: ["review_accounts"],
    byUniversity: true,
    async load(ctx) {
      const { profiles } = await people(ctx);
      const rows: Row[] = profiles
        .map((p) => ({
          name: name(p),
          email: p.email,
          university: uni(p.institution),
          year: p.year_of_study ?? "",
          programme: p.programme ?? "",
          roles: rolesLabel(rolesOf(p.account_type, p.extra_types)),
          status: ACCOUNT_STATUS_LABEL[p.account_status]?.label ?? p.account_status,
          joined: ukDateTime(p.created_at),
        }))
        .sort(byName);
      return {
        title: this.title,
        description: this.description,
        groupBy: "status",
        columns: [C.name, C.email, C.university, C.year, C.programme, C.roles, { key: "status", label: "Status", width: 16 }, { key: "joined", label: "Account created", width: 20 }],
        rows,
      };
    },
  },
  {
    key: "presenters",
    title: "Presenters and attendance",
    description: "Oral and poster presenters, what they're presenting, and whether they've confirmed they'll attend.",
    section: "Presenters",
    need: ["view_attendance", "review_accounts"],
    byUniversity: true,
    async load(ctx) {
      const { presenters } = await attendance(ctx);
      const ANSWER = { confirmed: "Confirmed", unavailable: "Can't make it", none: "No reply yet" } as const;
      const rows: Row[] = presenters
        .map((p) => ({
          name: p.name,
          email: p.email,
          university: uni(p.institution),
          type: p.type === "oral_presenter" ? "Oral" : "Poster",
          title: p.title ?? "",
          answer: ANSWER[p.answer],
          note: p.note ?? "",
          account: p.source === "account" ? "Set up" : "Not set up yet",
        }))
        .sort(byName);
      return {
        title: this.title,
        description: this.description,
        groupBy: "type",
        columns: [C.name, C.email, C.university, { key: "type", label: "Presenting", width: 11 }, { key: "title", label: "Title", width: 46 }, { key: "answer", label: "Attending", width: 15 }, { key: "note", label: "Their note", width: 30, wordHidden: true }, { key: "account", label: "Account", width: 14 }],
        rows,
      };
    },
  },
  {
    key: "waitlist",
    title: "Oral presentation waiting list",
    description: "Poster presenters waiting for an oral slot, in the order they joined the list.",
    section: "Presenters",
    need: ["view_attendance", "review_accounts"],
    byUniversity: true,
    async load(ctx) {
      const { waitlist } = await attendance(ctx);
      return {
        title: this.title,
        description: this.description,
        columns: [{ key: "position", label: "Place", width: 8 }, C.name, C.email, C.university, { key: "title", label: "Title", width: 46 }, { key: "since", label: "On the list since", width: 20 }],
        rows: waitlist.map((w, i) => ({ position: i + 1, name: w.name, email: w.email, university: uni(w.institution), title: w.title ?? "", since: ukDateTime(w.since) })),
      };
    },
  },
  {
    key: "submissions",
    title: "Slides and posters",
    description: "The latest slides or poster each presenter has uploaded, with its review status.",
    section: "Presenters",
    need: ["review_submissions"],
    byUniversity: true,
    async load(ctx) {
      const { data } = await ctx.db
        .from("presentation_submissions")
        .select("user_id, presenter_name, kind, version, title, status, file_name, created_at, qr_code_confirmed")
        .order("version", { ascending: false })
        .limit(5000);
      type Sub = { user_id: string; presenter_name: string; kind: SubmissionKind; version: number; title: string; status: SubmissionStatus; file_name: string; created_at: string; qr_code_confirmed?: boolean };
      const latest = new Map<string, Sub>();
      for (const s of (data ?? []) as Sub[]) if (!latest.has(`${s.user_id}:${s.kind}`)) latest.set(`${s.user_id}:${s.kind}`, s);
      // Universities only show for readers who can see profiles.
      const ids = [...new Set([...latest.values()].map((s) => s.user_id))];
      const { data: profs } = ids.length ? await ctx.db.from("profiles").select("id, institution, email").in("id", ids) : { data: [] };
      const prof = new Map((profs ?? []).map((p) => [p.id as string, p as { institution: string | null; email: string }]));
      const rows: Row[] = [...latest.values()]
        .map((s) => ({
          name: s.presenter_name,
          email: prof.get(s.user_id)?.email ?? "",
          university: uni(prof.get(s.user_id)?.institution),
          kind: SUBMISSION_LABEL[s.kind]?.title ?? s.kind,
          title: s.title,
          version: s.version,
          status: SUBMISSION_STATUS_LABEL[s.status]?.label ?? s.status,
          qr: s.kind === "poster" ? (s.qr_code_confirmed ? "Yes" : "Not yet") : "",
          file: s.file_name,
          uploaded: ukDateTime(s.created_at),
        }))
        .sort(byName);
      return {
        title: this.title,
        description: this.description,
        groupBy: "kind",
        columns: [
          C.name,
          C.email,
          C.university,
          { key: "kind", label: "Type", width: 18 },
          { key: "title", label: "Title", width: 44 },
          { key: "version", label: "Version", width: 9 },
          { key: "status", label: "Status", width: 20 },
          { key: "qr", label: "QR code on poster", width: 14 },
          { key: "file", label: "File", width: 30, wordHidden: true },
          { key: "uploaded", label: "Uploaded", width: 20 },
        ],
        rows,
      };
    },
  },
  {
    key: "transport",
    title: "Transport routes",
    description: "How each approved delegate is getting to INSPIRE (INSPIRE coach, their own coach, train, car or local), grouped by route.",
    section: "Travel",
    need: ["view_travel"],
    byUniversity: true,
    async load(ctx) {
      const { rows } = await travel(ctx);
      return {
        title: this.title,
        description: this.description,
        groupBy: "mode",
        columns: [C.name, C.email, C.university, { key: "mode", label: "Travelling by", width: 26 }, { key: "car", label: "Car registration", width: 16 }, { key: "answered", label: "Answered", width: 20 }],
        rows: rows.map((r) => ({
          name: r.name,
          email: r.email,
          university: uni(r.institution),
          mode: r.mode ? TRAVEL_LABEL[r.mode].label : "No answer yet",
          car: r.carRegistration ?? "",
          answered: ukDateTime(r.updatedAt),
        })),
      };
    },
  },
  {
    key: "cars",
    title: "Car registrations",
    description: "Delegates driving to INSPIRE and their registration plates, for parking and campus security.",
    section: "Travel",
    need: ["view_travel"],
    byUniversity: true,
    async load(ctx) {
      const { rows } = await travel(ctx);
      return {
        title: this.title,
        description: this.description,
        signColumn: "Permit given",
        columns: [{ key: "car", label: "Registration", width: 16 }, C.name, C.email, C.university, { key: "answered", label: "Answered", width: 20, wordHidden: true }],
        rows: rows
          .filter((r) => r.mode === "car")
          .map((r) => ({ car: r.carRegistration ?? "Not given", name: r.name, email: r.email, university: uni(r.institution), answered: ukDateTime(r.updatedAt) }))
          .sort((a, b) => a.car.localeCompare(b.car)),
      };
    },
  },
  {
    key: "workshop_places",
    title: "Workshop places",
    description: "Each person's workshop in each session, with the room and where they ranked it.",
    section: "Workshops",
    need: ["allocate_workshops"],
    byUniversity: true,
    async load(ctx) {
      const b = await board(ctx);
      const w = new Map(b.workshops.map((x) => [x.id, x]));
      const ids = [...new Set(b.allPlaces.map((p) => p.userId))];
      const slots = [1, 2, 3];
      const rows: Row[] = ids
        .map((id) => {
          const person = b.people.find((p) => p.id === id);
          const row: Row = { name: person?.name ?? "", email: person?.email ?? "", university: uni(person?.institution) };
          for (const s of slots) {
            const place = b.allPlaces.find((p) => p.userId === id && p.slot === s);
            const ws = place ? w.get(place.workshopId) : undefined;
            row[`s${s}`] = ws ? ws.title : "";
            row[`s${s}_room`] = ws?.room ?? "";
          }
          row.ranking = person?.ranking ? person.ranking.map((x, i) => `${i + 1}. ${w.get(x)?.title ?? ""}`).join("; ") : "Didn't rank";
          return row;
        })
        .sort(byName);
      const label = (s: number) => `Session ${s}${b.sessions[s - 1]?.time ? ` (${b.sessions[s - 1]!.time})` : ""}`;
      return {
        title: this.title,
        description: this.description,
        columns: [
          C.name,
          C.email,
          C.university,
          ...slots.flatMap((s): Column[] => [
            { key: `s${s}`, label: label(s), width: 30 },
            { key: `s${s}_room`, label: `Room ${s}`, width: 12 },
          ]),
          { key: "ranking", label: "Their ranking", width: 60, wordHidden: true },
        ],
        rows,
      };
    },
  },
  {
    key: "workshop_registers",
    title: "Workshop registers",
    description: "A register for every workshop in every session, with a column to tick people off. Each register starts on a new page in Word.",
    section: "Workshops",
    need: ["allocate_workshops"],
    byUniversity: true,
    async load(ctx) {
      const b = await board(ctx);
      const rows: Row[] = [];
      for (const s of [1, 2, 3]) {
        const session = b.sessions[s - 1];
        for (const ws of b.workshops) {
          const group = [`Session ${s}${session?.time ? `, ${session.time}` : ""}`, ws.title, ws.room ? `Room ${ws.room}` : null].filter(Boolean).join(" · ");
          for (const p of b.allPlaces.filter((x) => x.slot === s && x.workshopId === ws.id)) {
            const person = b.people.find((x) => x.id === p.userId);
            rows.push({ register: group, name: person?.name ?? "", email: person?.email ?? "", university: uni(person?.institution), choice: p.choice ?? "" });
          }
        }
      }
      rows.sort((a, b2) => String(a.register).localeCompare(String(b2.register), "en-GB", { numeric: true }) || byName(a, b2));
      return {
        title: this.title,
        description: this.description,
        groupBy: "register",
        pageBreakBetweenGroups: true,
        signColumn: "Attended",
        columns: [{ key: "register", label: "Register", width: 44, wordHidden: true }, C.name, C.university, C.email, { key: "choice", label: "Their choice", width: 12 }],
        rows,
      };
    },
  },
  {
    key: "checkin",
    title: "Check-in",
    description: "Every approved person and whether they've been checked in on the day.",
    section: "On the day",
    need: ["manage_people"],
    byUniversity: true,
    async load(ctx) {
      const [{ profiles }, checked] = await Promise.all([people(ctx), checkIns(ctx)]);
      return {
        title: this.title,
        description: this.description,
        groupBy: "university",
        signColumn: "Badge given",
        columns: [C.name, C.email, C.university, C.roles, { key: "checked_in", label: "Checked in", width: 20 }],
        rows: profiles
          .filter((p) => p.account_status === "approved")
          .map((p) => ({ name: name(p), email: p.email, university: uni(p.institution), roles: rolesLabel(rolesOf(p.account_type, p.extra_types)), checked_in: checked.get(p.id)?.at ? ukDateTime(checked.get(p.id)!.at) : "Not yet" }))
          .sort(byName),
      };
    },
  },
  {
    key: "dietary",
    title: "Dietary and access needs",
    description: "Approved people who told us about dietary requirements, access needs or not wanting to be photographed. For catering, venue and photography staff.",
    section: "On the day",
    need: ["manage_people"],
    byUniversity: true,
    async load(ctx) {
      const { profiles } = await people(ctx);
      return {
        title: this.title,
        description: this.description,
        columns: [C.name, C.email, C.university, C.roles, { key: "dietary", label: "Dietary requirements", width: 36 }, { key: "access", label: "Access needs", width: 36 }, { key: "photo", label: "No photos", width: 11 }],
        rows: profiles
          .filter((p) => p.account_status === "approved" && (p.dietary_requirements?.trim() || p.accessibility_needs?.trim() || p.photo_opt_out))
          .map((p) => ({
            name: name(p),
            email: p.email,
            university: uni(p.institution),
            roles: rolesLabel(rolesOf(p.account_type, p.extra_types)),
            dietary: p.dietary_requirements?.trim() ?? "",
            access: p.accessibility_needs?.trim() ?? "",
            photo: p.photo_opt_out ? "Yes" : "",
          }))
          .sort(byName),
      };
    },
  },
  {
    key: "programme",
    title: "Programme",
    description: "Every session on the day with its time and room.",
    section: "On the day",
    need: [],
    byUniversity: false,
    async load(ctx) {
      const { data: ed } = await ctx.db.from("editions").select("id").eq("is_current", true).maybeSingle();
      const { data } = await ctx.db.from("sessions").select("title, category, starts_at, ends_at, published, rooms(name, building)").eq("edition_id", ed?.id ?? "").order("starts_at").order("sort");
      type S = { title: string; category: SessionCategory; starts_at: string | null; ends_at: string | null; published: boolean; rooms: { name: string; building: string | null } | { name: string; building: string | null }[] | null };
      return {
        title: this.title,
        description: this.description,
        columns: [{ key: "start", label: "Starts", width: 9 }, { key: "end", label: "Ends", width: 9 }, { key: "title", label: "Session", width: 46 }, { key: "category", label: "Type", width: 20 }, { key: "room", label: "Room", width: 24 }, { key: "building", label: "Building", width: 36 }, { key: "published", label: "On the website", width: 14, wordHidden: true }],
        rows: ((data ?? []) as S[]).map((s) => {
          const room = Array.isArray(s.rooms) ? s.rooms[0] : s.rooms;
          return { start: ukTime(s.starts_at), end: ukTime(s.ends_at), title: s.title, category: SESSION_CATEGORY_LABEL[s.category] ?? s.category, room: room?.name ?? "", building: room?.building ?? "", published: s.published ? "Yes" : "Hidden" };
        }),
      };
    },
  },
  {
    key: "abstracts",
    title: "Abstracts",
    description: "Submitted abstracts with their decision and reviewer recommendations.",
    section: "Records",
    need: ["manage_people"],
    byUniversity: true,
    async load(ctx) {
      const { data: ed } = await ctx.db.from("editions").select("id").eq("is_current", true).maybeSingle();
      const { data } = await ctx.db.from("abstracts").select("*, review_assignments(reviews(status, recommendation))").eq("edition_id", ed?.id ?? "").neq("status", "draft").order("reference");
      type Rev = { status: string; recommendation: string | null };
      return {
        title: this.title,
        description: this.description,
        groupBy: "status",
        columns: [
          { key: "reference", label: "Reference", width: 12 },
          { key: "title", label: "Title", width: 46 },
          { key: "author", label: "Presenting author", width: 24 },
          C.email,
          C.university,
          { key: "category", label: "Category", width: 20 },
          { key: "preference", label: "Preference", width: 14, wordHidden: true },
          { key: "status", label: "Status", width: 14 },
          { key: "type", label: "Presentation", width: 14 },
          { key: "recommendations", label: "Reviewer recommendations", width: 30, wordHidden: true },
        ],
        rows: (data ?? []).map((a) => {
          const reviews = ((a.review_assignments ?? []) as { reviews: Rev | Rev[] | null }[]).map((x) => (Array.isArray(x.reviews) ? x.reviews[0] : x.reviews)).filter((r): r is Rev => r?.status === "submitted");
          const words = (s: unknown) => (typeof s === "string" ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");
          return {
            reference: a.reference ?? "",
            title: a.title ?? "",
            author: a.presenting_author ?? "",
            email: a.email ?? "",
            university: uni(a.university),
            category: words(a.category),
            preference: words(a.presentation_preference),
            status: words(a.status),
            type: words(a.presentation_type),
            recommendations: reviews.map((r) => words(r.recommendation)).join("; "),
          };
        }),
      };
    },
  },
];

export const datasetByKey = (key: string) => DATASETS.find((d) => d.key === key);

/** Whether this person may download a data set. Mirrors the page each set comes from. */
export function canDownload(d: Dataset, access: Access) {
  if (access.owner) return true;
  if (!d.need.length) return access.committee;
  return d.need.some((c) => access.can[c]);
}
