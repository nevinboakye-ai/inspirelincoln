-- =====================================================================
-- INSPIRE National Medical Research Conference: initial schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.
-- Security model:
--   * Row level security is enabled on every table.
--   * Public content is readable by anyone only when published.
--   * Roles live in public.profiles.role and are checked by SECURITY
--     DEFINER helpers so policies cannot be bypassed from the client.
--   * Writes to content tables require the editor or admin role.
--   * Abstracts, reviews, registrations and enquiries are personal data
--     and are never readable by the public.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role as enum ('delegate', 'reviewer', 'editor', 'admin');
create type public.conference_status as enum (
  'registration_soon', 'registration_open', 'registration_closed', 'underway', 'concluded'
);
create type public.session_category as enum (
  'keynote', 'research', 'workshop', 'networking', 'break', 'closing'
);
create type public.registration_status as enum ('pending', 'confirmed', 'waitlisted', 'cancelled');
create type public.abstract_status as enum (
  'draft', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted', 'withdrawn'
);
create type public.review_status as enum ('draft', 'submitted');
create type public.announcement_level as enum ('info', 'important', 'urgent');
create type public.announcement_audience as enum ('public', 'delegates', 'presenters');
create type public.enquiry_category as enum (
  'general', 'speakers_workshops', 'research_abstracts', 'partnerships', 'accessibility'
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (char_length(full_name) <= 120),
  institution text check (char_length(institution) <= 160),
  programme text check (char_length(programme) <= 160),
  year_of_study text check (char_length(year_of_study) <= 40),
  role public.user_role not null default 'delegate',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('editor', 'admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('reviewer', 'admin') from public.profiles where id = auth.uid()), false)
$$;

-- Create a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users cannot change their own role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Server-side contexts (SQL editor, service role) have no auth.uid() and are trusted.
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only administrators can change roles';
  end if;
  if new.email is distinct from old.email and not public.is_admin() then
    new.email = old.email;
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid() or public.is_admin());
-- Reviewers need no access to other profiles; abstracts carry the author details they need.

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
alter table public.audit_events enable row level security;
create policy "audit: admins read" on public.audit_events for select using (public.is_admin());
-- Inserts happen only via the SECURITY DEFINER trigger below.

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  changed jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) and k not in ('updated_at') then
        -- Record which fields changed, not the personal data itself.
        changed := changed || jsonb_build_object(k, true);
      end if;
    end loop;
  end if;
  insert into public.audit_events (actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, rec ->> 'id',
          case when tg_op = 'UPDATE' then jsonb_build_object('changed', changed) else '{}'::jsonb end);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- Conference editions (the current edition is configurable)
-- ---------------------------------------------------------------------
create table public.editions (
  id uuid primary key default gen_random_uuid(),
  year int not null unique check (year between 2000 and 2100),
  slug text not null unique,
  name text not null,
  theme text not null,
  theme_statement text not null default '',
  event_date date not null,
  start_time time,
  end_time time,
  timezone text not null default 'Europe/London',
  venue_name text not null,
  venue_institution text not null default '',
  venue_address text not null default '',
  venue_notes text,
  expected_attendance int check (expected_attendance > 0),
  status public.conference_status,
  registration_url text check (registration_url is null or registration_url ~* '^https://'),
  registration_note text,
  event_day_mode boolean not null default false,
  post_event_mode boolean not null default false,
  is_current boolean not null default false,
  highlights text,
  host_institution text,
  poster_deadline date,
  poster_requirements text[] not null default '{}',
  abstract_config jsonb not null default '{}'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);
create unique index editions_one_current on public.editions (is_current) where is_current;
create trigger editions_touch before update on public.editions for each row execute function public.touch_updated_at();
create trigger editions_audit after insert or update or delete on public.editions for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Venues and rooms
-- ---------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  name text not null,
  building text,
  floor text,
  directions text,
  capacity int check (capacity > 0),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Speakers, workshops, sessions
-- ---------------------------------------------------------------------
create table public.speakers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  full_name text not null,
  credentials text,
  position text,
  institution text,
  specialty text,
  session_type public.session_category,
  bio text,
  research_interests text[] not null default '{}',
  portrait_url text,
  links jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger speakers_touch before update on public.speakers for each row execute function public.touch_updated_at();

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  number int not null check (number > 0),
  title text not null,
  strapline text not null default '',
  summary text not null default '',
  description text not null default '',
  topics text[] not null default '{}',
  outcomes text[] not null default '{}',
  audience text not null default '',
  facilitator text,
  facilitator_bio text,
  capacity int check (capacity > 0),
  booking_enabled boolean not null default false,
  accent text not null default 'electric' check (accent in ('electric', 'cyan', 'violet')),
  motif text not null default 'pulse' check (motif in ('manuscript', 'pulse', 'evidence', 'portfolio', 'simulation', 'globe')),
  notes text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, slug),
  unique (edition_id, number)
);
create trigger workshops_touch before update on public.workshops for each row execute function public.touch_updated_at();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  category public.session_category not null,
  starts_at timestamptz,
  ends_at timestamptz,
  room_id uuid references public.rooms (id) on delete set null,
  workshop_id uuid references public.workshops (id) on delete set null,
  description text not null default '',
  objectives text[] not null default '{}',
  capacity int check (capacity > 0),
  is_provisional boolean not null default true,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, slug),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger sessions_touch before update on public.sessions for each row execute function public.touch_updated_at();

create table public.session_speakers (
  session_id uuid not null references public.sessions (id) on delete cascade,
  speaker_id uuid not null references public.speakers (id) on delete cascade,
  primary key (session_id, speaker_id)
);

-- ---------------------------------------------------------------------
-- Registrations, check-in and personal agendas
-- ---------------------------------------------------------------------
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.registration_status not null default 'pending',
  source text not null default 'manual' check (source in ('manual', 'import', 'external')),
  external_reference text,
  -- Opaque token encoded in the delegate QR code. Contains no personal data.
  checkin_token uuid not null unique default gen_random_uuid(),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, user_id)
);
create trigger registrations_touch before update on public.registrations for each row execute function public.touch_updated_at();
create trigger registrations_audit after insert or update or delete on public.registrations for each row execute function public.audit_row_change();

create table public.agenda_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table public.saved_workshops (
  user_id uuid not null references auth.users (id) on delete cascade,
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, workshop_id)
);

-- ---------------------------------------------------------------------
-- Abstracts, review and presenters
-- ---------------------------------------------------------------------
create table public.abstracts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete restrict,
  submitter_id uuid not null references auth.users (id) on delete cascade,
  reference text not null unique default ('ABS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  presenting_author text not null check (char_length(presenting_author) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  university text not null check (char_length(university) <= 160),
  programme_year text not null check (char_length(programme_year) <= 120),
  title text not null check (char_length(title) between 5 and 300),
  co_authors text not null default '' check (char_length(co_authors) <= 2000),
  category text not null,
  presentation_preference text,
  background text not null default '',
  aim text not null default '',
  methods text not null default '',
  results text not null default '',
  conclusion text not null default '',
  file_path text,
  consent_data boolean not null default false,
  declaration_original boolean not null default false,
  consent_showcase boolean not null default false,
  status public.abstract_status not null default 'draft',
  decision_note text,
  presentation_type text,
  showcase_published boolean not null default false,
  showcase_summary text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A submitted abstract must carry both required consents.
  check (status = 'draft' or (consent_data and declaration_original)),
  -- Only consented work can ever appear in the public showcase.
  check (not showcase_published or (consent_showcase and status = 'accepted'))
);
create index abstracts_edition_status_idx on public.abstracts (edition_id, status);
create trigger abstracts_touch before update on public.abstracts for each row execute function public.touch_updated_at();
create trigger abstracts_audit after insert or update or delete on public.abstracts for each row execute function public.audit_row_change();

-- Authors may edit drafts only, and can never set decision fields themselves.
create or replace function public.guard_abstract_author_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    if new.status in ('accepted', 'rejected', 'waitlisted') and old.status is distinct from new.status then
      new.decided_at = now();
    end if;
    return new;
  end if;
  if old.status <> 'draft' then
    -- After submission an author may only withdraw.
    if new.status = 'withdrawn' and old.status in ('submitted', 'under_review') then
      old.status := 'withdrawn';
      old.updated_at := now();
      return old;
    end if;
    raise exception 'Submitted abstracts cannot be edited';
  end if;
  if new.status not in ('draft', 'submitted') then
    raise exception 'Invalid status change';
  end if;
  new.decision_note = old.decision_note;
  new.presentation_type = old.presentation_type;
  new.showcase_published = old.showcase_published;
  new.decided_at = old.decided_at;
  new.submitter_id = old.submitter_id;
  new.edition_id = old.edition_id;
  if new.status = 'submitted' then
    new.submitted_at = now();
  end if;
  return new;
end $$;
create trigger abstracts_guard before update on public.abstracts
  for each row execute function public.guard_abstract_author_update();

create table public.review_criteria (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  label text not null,
  description text not null default '',
  max_score int not null default 5 check (max_score between 1 and 100),
  weight numeric(4, 2) not null default 1 check (weight > 0),
  sort int not null default 0
);

create table public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  abstract_id uuid not null references public.abstracts (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (abstract_id, reviewer_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.review_assignments (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  comments text not null default '' check (char_length(comments) <= 5000),
  confidential_comments text not null default '' check (char_length(confidential_comments) <= 5000),
  recommendation text check (recommendation in ('accept', 'reject', 'waitlist')),
  status public.review_status not null default 'draft',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

create or replace function public.guard_review_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status = 'submitted' and not public.is_admin() and auth.uid() is not null then
    raise exception 'Submitted reviews cannot be changed';
  end if;
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status = 'draft') then
    new.submitted_at = now();
  end if;
  return new;
end $$;
create trigger reviews_guard before insert or update on public.reviews for each row execute function public.guard_review_update();

create table public.poster_uploads (
  id uuid primary key default gen_random_uuid(),
  abstract_id uuid not null references public.abstracts (id) on delete cascade,
  file_path text not null,
  orientation text check (orientation in ('landscape', 'portrait')),
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'received' check (status in ('received', 'approved', 'needs_changes')),
  admin_note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Public content
-- ---------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete cascade,
  title text not null,
  body text not null default '',
  level public.announcement_level not null default 'info',
  audience public.announcement_audience not null default 'public',
  pinned boolean not null default false,
  published boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete cascade,
  question text not null,
  answer text not null,
  category text not null default 'General',
  sort int not null default 0,
  published boolean not null default true
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  category text not null,
  organisation text,
  summary text not null default '',
  description text not null default '',
  eligibility text,
  deadline date,
  url text check (url is null or url ~* '^https?://'),
  is_example boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.saved_opportunities (
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create table public.gallery_assets (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete set null,
  year int not null,
  kind text not null default 'image' check (kind in ('image', 'video')),
  url text not null,
  thumbnail_url text,
  caption text not null default '',
  alt text not null default '',
  width int not null default 1600,
  height int not null default 1067,
  credit text,
  downloadable boolean not null default false,
  published boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  url text,
  relationship text not null,
  published boolean not null default false,
  sort int not null default 0
);

create table public.committee_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  institution text,
  bio text,
  photo_url text,
  links jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  sort int not null default 0
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  year text not null,
  title text not null,
  description text not null default '',
  verified boolean not null default false,
  published boolean not null default false,
  sort int not null default 0
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  summary text not null default '',
  url text,
  is_example boolean not null default false,
  published boolean not null default false,
  sort int not null default 0
);

create table public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger site_content_touch before update on public.site_content for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Contact enquiries
-- ---------------------------------------------------------------------
create table public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  category public.enquiry_category not null,
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 20 and 5000),
  consent boolean not null check (consent),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  delivered boolean not null default false,
  created_at timestamptz not null default now()
);
create index contact_enquiries_created_idx on public.contact_enquiries (created_at desc);

-- Light abuse protection: at most 5 enquiries per email address per hour.
create or replace function public.limit_contact_rate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_enquiries
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger contact_rate before insert on public.contact_enquiries
  for each row execute function public.limit_contact_rate();

-- ---------------------------------------------------------------------
-- Row level security policies
-- ---------------------------------------------------------------------
alter table public.editions enable row level security;
create policy "editions: public read" on public.editions for select using (published or public.is_editor());
create policy "editions: editors write" on public.editions for all using (public.is_editor()) with check (public.is_editor());

alter table public.rooms enable row level security;
create policy "rooms: public read" on public.rooms for select using (true);
create policy "rooms: editors write" on public.rooms for all using (public.is_editor()) with check (public.is_editor());

alter table public.speakers enable row level security;
create policy "speakers: public read" on public.speakers for select using (published or public.is_editor());
create policy "speakers: editors write" on public.speakers for all using (public.is_editor()) with check (public.is_editor());

alter table public.workshops enable row level security;
create policy "workshops: public read" on public.workshops for select using (published or public.is_editor());
create policy "workshops: editors write" on public.workshops for all using (public.is_editor()) with check (public.is_editor());

alter table public.sessions enable row level security;
create policy "sessions: public read" on public.sessions for select using (published or public.is_editor());
create policy "sessions: editors write" on public.sessions for all using (public.is_editor()) with check (public.is_editor());

alter table public.session_speakers enable row level security;
create policy "session_speakers: public read" on public.session_speakers for select using (true);
create policy "session_speakers: editors write" on public.session_speakers for all using (public.is_editor()) with check (public.is_editor());

alter table public.registrations enable row level security;
create policy "registrations: own or admin read" on public.registrations for select using (user_id = auth.uid() or public.is_admin());
create policy "registrations: admins write" on public.registrations for all using (public.is_admin()) with check (public.is_admin());

alter table public.agenda_items enable row level security;
create policy "agenda: own" on public.agenda_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.saved_workshops enable row level security;
create policy "saved_workshops: own" on public.saved_workshops for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.saved_opportunities enable row level security;
create policy "saved_opportunities: own" on public.saved_opportunities for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.abstracts enable row level security;
create policy "abstracts: author read" on public.abstracts for select using (submitter_id = auth.uid());
create policy "abstracts: assigned reviewer read" on public.abstracts for select using (
  public.is_reviewer() and status <> 'draft' and exists (
    select 1 from public.review_assignments ra where ra.abstract_id = abstracts.id and ra.reviewer_id = auth.uid()
  )
);
create policy "abstracts: admin read" on public.abstracts for select using (public.is_admin());
create policy "abstracts: author create" on public.abstracts for insert with check (
  submitter_id = auth.uid() and status in ('draft', 'submitted')
  and not showcase_published and decision_note is null and presentation_type is null
  and exists (
    select 1 from public.editions e where e.id = edition_id and coalesce((e.abstract_config ->> 'submissionsOpen')::boolean, false)
  )
);
create policy "abstracts: author or admin update" on public.abstracts for update using (submitter_id = auth.uid() or public.is_admin());
create policy "abstracts: admin delete" on public.abstracts for delete using (public.is_admin());

-- Public showcase exposes only consented, accepted, explicitly published work.
create view public.showcase_abstracts with (security_invoker = false) as
  select a.id, a.title, a.presenting_author, a.co_authors, a.university, a.category,
         coalesce(a.showcase_summary, a.conclusion) as summary, e.year
  from public.abstracts a join public.editions e on e.id = a.edition_id
  where a.showcase_published and a.consent_showcase and a.status = 'accepted';
grant select on public.showcase_abstracts to anon, authenticated;

alter table public.review_criteria enable row level security;
create policy "criteria: reviewers read" on public.review_criteria for select using (public.is_reviewer());
create policy "criteria: admins write" on public.review_criteria for all using (public.is_admin()) with check (public.is_admin());

alter table public.review_assignments enable row level security;
create policy "assignments: own or admin read" on public.review_assignments for select using (reviewer_id = auth.uid() or public.is_admin());
create policy "assignments: admins write" on public.review_assignments for all using (public.is_admin()) with check (public.is_admin());

alter table public.reviews enable row level security;
create policy "reviews: own or admin read" on public.reviews for select using (
  public.is_admin() or exists (select 1 from public.review_assignments ra where ra.id = assignment_id and ra.reviewer_id = auth.uid())
);
create policy "reviews: own insert" on public.reviews for insert with check (
  exists (select 1 from public.review_assignments ra where ra.id = assignment_id and ra.reviewer_id = auth.uid())
);
create policy "reviews: own update" on public.reviews for update using (
  public.is_admin() or exists (select 1 from public.review_assignments ra where ra.id = assignment_id and ra.reviewer_id = auth.uid())
);

alter table public.poster_uploads enable row level security;
create policy "posters: own or admin read" on public.poster_uploads for select using (uploaded_by = auth.uid() or public.is_admin());
create policy "posters: accepted author insert" on public.poster_uploads for insert with check (
  uploaded_by = auth.uid() and exists (
    select 1 from public.abstracts a where a.id = abstract_id and a.submitter_id = auth.uid() and a.status = 'accepted'
  )
);
create policy "posters: admins update" on public.poster_uploads for update using (public.is_admin());

alter table public.announcements enable row level security;
create policy "announcements: public read" on public.announcements for select using (
  (published and audience = 'public' and (expires_at is null or expires_at > now()))
  or (published and auth.uid() is not null and (expires_at is null or expires_at > now()))
  or public.is_editor()
);
create policy "announcements: editors write" on public.announcements for all using (public.is_editor()) with check (public.is_editor());

alter table public.faqs enable row level security;
create policy "faqs: public read" on public.faqs for select using (published or public.is_editor());
create policy "faqs: editors write" on public.faqs for all using (public.is_editor()) with check (public.is_editor());

alter table public.opportunities enable row level security;
create policy "opportunities: public read" on public.opportunities for select using (published or public.is_editor());
create policy "opportunities: editors write" on public.opportunities for all using (public.is_editor()) with check (public.is_editor());

alter table public.gallery_assets enable row level security;
create policy "gallery: public read" on public.gallery_assets for select using (published or public.is_editor());
create policy "gallery: editors write" on public.gallery_assets for all using (public.is_editor()) with check (public.is_editor());

alter table public.partners enable row level security;
create policy "partners: public read" on public.partners for select using (published or public.is_editor());
create policy "partners: editors write" on public.partners for all using (public.is_editor()) with check (public.is_editor());

alter table public.committee_members enable row level security;
create policy "committee: public read" on public.committee_members for select using (published or public.is_editor());
create policy "committee: editors write" on public.committee_members for all using (public.is_editor()) with check (public.is_editor());

alter table public.timeline_events enable row level security;
create policy "timeline: public read verified" on public.timeline_events for select using ((published and verified) or public.is_editor());
create policy "timeline: editors write" on public.timeline_events for all using (public.is_editor()) with check (public.is_editor());

alter table public.resources enable row level security;
create policy "resources: public read" on public.resources for select using (published or public.is_editor());
create policy "resources: editors write" on public.resources for all using (public.is_editor()) with check (public.is_editor());

alter table public.site_content enable row level security;
create policy "site_content: public read" on public.site_content for select using (true);
create policy "site_content: editors write" on public.site_content for all using (public.is_editor()) with check (public.is_editor());

alter table public.contact_enquiries enable row level security;
-- Anyone may submit an enquiry; nobody but admins may read them.
create policy "enquiries: anyone insert" on public.contact_enquiries for insert with check (consent and status = 'new');
create policy "enquiries: admins read" on public.contact_enquiries for select using (public.is_admin());
create policy "enquiries: admins update" on public.contact_enquiries for update using (public.is_admin());
create policy "enquiries: admins delete" on public.contact_enquiries for delete using (public.is_admin());

-- Audit content changes made through the dashboard.
create trigger speakers_audit after insert or update or delete on public.speakers for each row execute function public.audit_row_change();
create trigger sessions_audit after insert or update or delete on public.sessions for each row execute function public.audit_row_change();
create trigger workshops_audit after insert or update or delete on public.workshops for each row execute function public.audit_row_change();
create trigger announcements_audit after insert or update or delete on public.announcements for each row execute function public.audit_row_change();
create trigger profiles_audit after update on public.profiles for each row execute function public.audit_row_change();
create trigger reviews_audit after insert or update or delete on public.reviews for each row execute function public.audit_row_change();
create trigger assignments_audit after insert or update or delete on public.review_assignments for each row execute function public.audit_row_change();
create trigger posters_audit after insert or update or delete on public.poster_uploads for each row execute function public.audit_row_change();
create trigger enquiries_audit after update or delete on public.contact_enquiries for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Check-in: admins look up a registration by its opaque QR token.
-- ---------------------------------------------------------------------
create or replace function public.check_in(token uuid)
returns table (registration_id uuid, full_name text, status public.registration_status, already_checked_in boolean, checked_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  r public.registrations;
  prior timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;
  select * into r from public.registrations where checkin_token = token;
  if not found then
    return;
  end if;
  prior := r.checked_in_at;
  if r.status = 'confirmed' and r.checked_in_at is null then
    update public.registrations set checked_in_at = now(), checked_in_by = auth.uid() where id = r.id returning * into r;
  end if;
  return query select r.id, p.full_name, r.status, prior is not null, r.checked_in_at
    from public.profiles p where p.id = r.user_id;
end $$;

-- ---------------------------------------------------------------------
-- Storage buckets
--   media    : public images (speakers, gallery, logos). Editors upload.
--   abstracts: private supporting files. Author + admins.
--   posters  : private poster files. Author + admins.
-- Paths for private buckets start with the uploader's user id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 8 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('abstracts', 'abstracts', false, 10 * 1024 * 1024, array['application/pdf']),
  ('posters', 'posters', false, 25 * 1024 * 1024, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "media: public read" on storage.objects for select using (bucket_id = 'media');
create policy "media: editors write" on storage.objects for insert with check (bucket_id = 'media' and public.is_editor());
create policy "media: editors update" on storage.objects for update using (bucket_id = 'media' and public.is_editor());
create policy "media: editors delete" on storage.objects for delete using (bucket_id = 'media' and public.is_editor());

create policy "private files: owner or admin read" on storage.objects for select using (
  bucket_id in ('abstracts', 'posters')
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy "private files: owner upload" on storage.objects for insert with check (
  bucket_id in ('abstracts', 'posters') and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "private files: admin delete" on storage.objects for delete using (
  bucket_id in ('abstracts', 'posters') and public.is_admin()
);
