-- =====================================================================
-- Personal programmes, live "where to go next" alerts and the on-the-day
-- scanner.
--
--   * My day: each person sees their own programme for the day, with the
--     room for each of their three workshops once places are published.
--     The committee can also put anyone in a particular session (for
--     example an oral presenter in the INB room, or a helper on the
--     registration desk), and it shows in that person's day.
--   * Live alerts: on the day, a few minutes before each part of the
--     programme starts, every page of the website shows a card telling
--     people where to go next. People with the new "On-screen alerts"
--     permission can turn this off, change how early it shows, or send an
--     alert of their own to everyone straight away.
--   * The scanner: committee members with the new "On-the-day scanner"
--     permission get a scanner on the home page of My Hub. Scanning a
--     Delegate Card shows that person's day, where they should be now and
--     next, and marks them at a workshop. Marking someone at a workshop
--     also checks them in to the conference if they weren't already.
--   * Every change goes through the functions below, which check who is
--     asking. All of it is removed with the account.
--
-- Setup file 42. Run after 29-workshop-choices.sql and 35-workshops-rank-six.sql.
-- Safe to run more than once.
-- =====================================================================

-- Permissions ------------------------------------------------------------
insert into public.access_capabilities (key, label, description, sort) values
  ('day_scanner', 'On-the-day scanner', 'Scan Delegate Cards from My Hub to see someone''s programme for the day and mark them at a workshop.', 62),
  ('live_alerts', 'On-screen alerts', 'Turn the "where to go next" alerts on or off, place people in sessions, and send an alert to every screen.', 64)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

-- Every committee member can use the scanner. Alerts start with the
-- executive committee, vice president and president.
insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'day_scanner',
       t.account_type not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;
insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'live_alerts',
       t.account_type in ('executive_committee', 'vice_president', 'president')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

create or replace function public.can_scan_day()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('day_scanner') or public.can_check_in() or public.has_access('allocate_workshops') or public.is_site_owner()
$$;

create or replace function public.is_committee_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.account_status = 'approved' and exists (
             select 1 from unnest(public.all_types(p.account_type, p.extra_types)) r
              where r not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist'))
      from public.profiles p where p.id = auth.uid()
  ), false) or public.is_site_owner()
$$;

-- Who goes where -----------------------------------------------------------
-- A person placed in one session, for when the programme runs two things
-- at once, or for a job on the day.
create table if not exists public.programme_assignments (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  role text not null default 'attending' check (role in ('attending', 'presenting', 'judging', 'chairing', 'helping')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (user_id, session_id)
);
create index if not exists programme_assignments_session_idx on public.programme_assignments (session_id);
alter table public.programme_assignments enable row level security;
drop policy if exists "assignments: own or staff read" on public.programme_assignments;
drop policy if exists "assignments: managers write" on public.programme_assignments;
create policy "assignments: own or staff read" on public.programme_assignments for select
  using (user_id = auth.uid() or public.can_scan_day() or public.has_access('live_alerts'));
create policy "assignments: managers write" on public.programme_assignments for all
  using (public.has_access('live_alerts') or public.has_access('allocate_workshops'))
  with check (public.has_access('live_alerts') or public.has_access('allocate_workshops'));
revoke all on public.programme_assignments from anon;
grant select, insert, update, delete on public.programme_assignments to authenticated;

-- Workshop attendance --------------------------------------------------------
create table if not exists public.workshop_attendance (
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  marked_at timestamptz not null default now(),
  marked_by uuid references public.profiles (id) on delete set null,
  primary key (edition_id, user_id, slot)
);
create index if not exists workshop_attendance_workshop_idx on public.workshop_attendance (workshop_id, slot);
alter table public.workshop_attendance enable row level security;
drop policy if exists "workshop attendance: own or staff read" on public.workshop_attendance;
create policy "workshop attendance: own or staff read" on public.workshop_attendance for select
  using (user_id = auth.uid() or public.can_scan_day());
revoke all on public.workshop_attendance from anon;
revoke insert, update, delete on public.workshop_attendance from authenticated;
grant select on public.workshop_attendance to authenticated;

-- Live alerts ------------------------------------------------------------------
create table if not exists public.live_alert_settings (
  edition_id uuid primary key references public.editions (id) on delete cascade,
  auto_enabled boolean not null default true,
  lead_minutes smallint not null default 10 check (lead_minutes between 2 and 45),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.live_alert_settings enable row level security;
drop policy if exists "alert settings: read" on public.live_alert_settings;
drop policy if exists "alert settings: managers write" on public.live_alert_settings;
create policy "alert settings: read" on public.live_alert_settings for select using (true);
create policy "alert settings: managers write" on public.live_alert_settings for all
  using (public.has_access('live_alerts')) with check (public.has_access('live_alerts'));
grant select on public.live_alert_settings to anon, authenticated;
revoke insert, update, delete on public.live_alert_settings from anon;
grant insert, update on public.live_alert_settings to authenticated;

insert into public.live_alert_settings (edition_id)
select id from public.editions where is_current
on conflict do nothing;

-- An alert sent by the committee, shown on every page while it's live.
create table if not exists public.live_alerts (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 90),
  body text check (char_length(body) <= 300),
  place text check (char_length(place) <= 90),
  map_slug text check (map_slug is null or map_slug ~ '^[a-z0-9-]+$'),
  audience text not null default 'everyone' check (audience in ('everyone', 'signed_in', 'committee')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists live_alerts_live_idx on public.live_alerts (ends_at desc);
alter table public.live_alerts enable row level security;
drop policy if exists "live alerts: audience read" on public.live_alerts;
drop policy if exists "live alerts: managers write" on public.live_alerts;
create policy "live alerts: audience read" on public.live_alerts for select using (
  audience = 'everyone'
  or (audience = 'signed_in' and auth.uid() is not null)
  or (audience = 'committee' and public.is_committee_member())
  or public.has_access('live_alerts')
);
create policy "live alerts: managers write" on public.live_alerts for all
  using (public.has_access('live_alerts')) with check (public.has_access('live_alerts'));
grant select on public.live_alerts to anon, authenticated;
revoke insert, update, delete on public.live_alerts from anon;
grant insert, update, delete on public.live_alerts to authenticated;

-- ---------------------------------------------------------------------
-- Everything the scanner needs about one person: who they are, whether
-- they're in, their workshop places (published or not), the sessions
-- they've been placed in and the workshops they've been marked at.
-- ---------------------------------------------------------------------
create or replace function public.day_person(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t public.profiles;
  ed uuid := public.current_edition_id();
begin
  if not public.can_scan_day() then raise exception 'NOT_ALLOWED'; end if;
  select * into t from public.profiles where id = target;
  if t.id is null then return null; end if;
  return jsonb_build_object(
    'id', t.id,
    'full_name', t.full_name,
    'institution', t.institution,
    'year_of_study', t.year_of_study,
    'avatar_path', t.avatar_path,
    'committee_position', t.committee_position,
    'roles', to_jsonb(public.all_types(t.account_type, t.extra_types)),
    'accessibility_needs', t.accessibility_needs,
    'places', coalesce((select jsonb_agg(jsonb_build_object('slot', a.slot, 'workshop_id', a.workshop_id) order by a.slot)
                          from public.workshop_allocations a where a.edition_id = ed and a.user_id = t.id), '[]'),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object('session_id', x.session_id, 'role', x.role, 'note', x.note))
                               from public.programme_assignments x where x.edition_id = ed and x.user_id = t.id), '[]'),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('slot', w.slot, 'workshop_id', w.workshop_id, 'marked_at', w.marked_at,
                                                           'marked_by', (select b.full_name from public.profiles b where b.id = w.marked_by)) order by w.slot)
                         from public.workshop_attendance w where w.edition_id = ed and w.user_id = t.id), '[]')
  ) || public.attendance_json(t.id);
end $$;

-- Find a person from a scanned card code or an older check-in code.
create or replace function public.day_find(p_code text default null, p_token uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare target uuid;
begin
  if not public.can_scan_day() then raise exception 'NOT_ALLOWED'; end if;
  if p_code is not null then
    select id into target from public.profiles where card_code = public.clean_card_code(p_code);
  elsif p_token is not null then
    select user_id into target from public.registrations where checkin_token = p_token;
  end if;
  if target is null then return null; end if;
  return public.day_person(target);
end $$;

-- Find someone by name, university or full email.
create or replace function public.day_search(q text)
returns table (id uuid, full_name text, institution text, roles public.account_type[], checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.institution, public.all_types(p.account_type, p.extra_types), r.checked_in_at
    from public.profiles p
    left join public.editions e on e.is_current
    left join public.registrations r on r.user_id = p.id and r.edition_id = e.id
   where (public.can_scan_day() or public.has_access('live_alerts'))
     and char_length(trim(q)) >= 2
     and p.account_status = 'approved'
     and (p.full_name ilike '%' || trim(q) || '%' or p.institution ilike '%' || trim(q) || '%' or lower(p.email) = lower(trim(q)))
   order by lower(p.full_name)
   limit 20
$$;

-- Mark someone at a workshop. With no workshop given, the one they were
-- placed in for that session. Checks them in to the conference too.
--   result: marked | already | changed | no_place | not_approved | no_event | unknown
create or replace function public.mark_workshop_attendance(target uuid, p_slot int, p_workshop uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  t public.profiles;
  w uuid := p_workshop;
  prev uuid;
  reg public.registrations;
  checked boolean := false;
  result text;
begin
  if not public.can_scan_day() then raise exception 'NOT_ALLOWED'; end if;
  if p_slot is null or p_slot not between 1 and 3 then raise exception 'BAD_SESSION'; end if;
  select * into t from public.profiles where id = target;
  if t.id is null then return jsonb_build_object('result', 'unknown'); end if;
  if ed is null then return jsonb_build_object('result', 'no_event'); end if;
  if t.account_status <> 'approved' then return jsonb_build_object('result', 'not_approved'); end if;
  if w is null then
    select workshop_id into w from public.workshop_allocations where edition_id = ed and user_id = t.id and slot = p_slot;
    if w is null then return jsonb_build_object('result', 'no_place'); end if;
  elsif not exists (select 1 from public.workshops where id = w and edition_id = ed) then
    raise exception 'BAD_WORKSHOP';
  end if;

  select workshop_id into prev from public.workshop_attendance where edition_id = ed and user_id = t.id and slot = p_slot;
  if prev = w then
    result := 'already';
  else
    insert into public.workshop_attendance (edition_id, user_id, slot, workshop_id, marked_at, marked_by)
    values (ed, t.id, p_slot, w, now(), auth.uid())
    on conflict (edition_id, user_id, slot) do update set workshop_id = excluded.workshop_id, marked_at = now(), marked_by = auth.uid();
    result := case when prev is null then 'marked' else 'changed' end;
  end if;

  -- They're here, so they're checked in.
  select * into reg from public.registrations where edition_id = ed and user_id = t.id for update;
  if reg.id is null then
    insert into public.registrations (edition_id, user_id, status, source, checked_in_at, checked_in_by)
    values (ed, t.id, 'confirmed', 'manual', now(), auth.uid());
    checked := true;
  elsif reg.status = 'confirmed' and reg.checked_in_at is null then
    update public.registrations set checked_in_at = now(), checked_in_by = auth.uid() where id = reg.id;
    checked := true;
  end if;

  return jsonb_build_object('result', result, 'checked_in_now', checked, 'workshop_id', w, 'person', public.day_person(t.id));
end $$;

create or replace function public.unmark_workshop_attendance(target uuid, p_slot int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id();
begin
  if not public.can_scan_day() then raise exception 'NOT_ALLOWED'; end if;
  delete from public.workshop_attendance where edition_id = ed and user_id = target and slot = p_slot;
  return jsonb_build_object('result', 'undone', 'person', public.day_person(target));
end $$;

-- For the committee: in each session, how many were placed in each
-- workshop and how many have been marked there.
create or replace function public.workshop_attendance_summary()
returns table (slot smallint, workshop_id uuid, placed bigint, marked bigint)
language sql stable security definer set search_path = public as $$
  with ed as (select public.current_edition_id() as id),
  pairs as (
    select s.slot::smallint as slot, w.id as workshop_id
      from public.workshops w, ed, generate_series(1, 3) s(slot)
     where w.edition_id = ed.id and w.published
  )
  select p.slot, p.workshop_id,
         (select count(*) from public.workshop_allocations a, ed where a.edition_id = ed.id and a.slot = p.slot and a.workshop_id = p.workshop_id),
         (select count(*) from public.workshop_attendance m, ed where m.edition_id = ed.id and m.slot = p.slot and m.workshop_id = p.workshop_id)
    from pairs p
   where public.can_scan_day()
   order by p.slot, p.workshop_id
$$;

revoke all on function public.can_scan_day() from public, anon;
revoke all on function public.is_committee_member() from public, anon;
revoke all on function public.day_person(uuid) from public, anon;
revoke all on function public.day_find(text, uuid) from public, anon;
revoke all on function public.day_search(text) from public, anon;
revoke all on function public.mark_workshop_attendance(uuid, int, uuid) from public, anon;
revoke all on function public.unmark_workshop_attendance(uuid, int) from public, anon;
revoke all on function public.workshop_attendance_summary() from public, anon;
grant execute on function public.can_scan_day() to authenticated;
grant execute on function public.is_committee_member() to anon, authenticated;
grant execute on function public.day_person(uuid) to authenticated;
grant execute on function public.day_find(text, uuid) to authenticated;
grant execute on function public.day_search(text) to authenticated;
grant execute on function public.mark_workshop_attendance(uuid, int, uuid) to authenticated;
grant execute on function public.unmark_workshop_attendance(uuid, int) to authenticated;
grant execute on function public.workshop_attendance_summary() to authenticated;
