-- =====================================================================
-- Oral presentation rooms.
--
--   * The oral presentations run as two programme sessions at the same
--     time, one in each room (for 2026, the Isaac Newton Building and
--     LMS0005). The committee shares the oral presenters between the two
--     rooms from Committee dashboard > Oral presentation rooms.
--   * "Allocate at random" shares people out fairly, filling each room up
--     to the number of talks it takes, in a random running order. Anyone
--     the committee has placed by hand is locked, and keeps their room and
--     place in the running order when the allocation is run again.
--   * Once the committee shows the rooms to presenters, each oral presenter
--     sees their room and talk number in My Hub and in their day, and the
--     "where to go next" alerts send them to the right room. Judges see
--     the room and talk number beside each oral presentation.
--   * Presenters are matched by email, so people on the selected list who
--     haven't set up their account yet can be placed too.
--   * A new permission, "Oral presentation rooms" (allocate_orals), starts
--     with whoever already has "Workshop places".
--   * Every change goes through the functions below, which check who is
--     asking. Safe to run more than once.
-- =====================================================================

insert into public.access_capabilities (key, label, description, sort) values
  ('allocate_orals', 'Oral presentation rooms', 'Share the oral presenters between the two oral presentation rooms, set the running order and show presenters their room.', 57)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

-- Start with exactly who can already allocate workshop places.
insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'allocate_orals',
       coalesce((select r.allowed from public.access_rules r where r.account_type = t.account_type::public.account_type and r.capability = 'allocate_workshops'),
                t.account_type in ('executive_committee', 'vice_president', 'president'))
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

insert into public.access_overrides (user_id, capability, allowed, note, updated_by, updated_at)
select o.user_id, 'allocate_orals', o.allowed, o.note, o.updated_by, now()
  from public.access_overrides o
 where o.capability = 'allocate_workshops'
on conflict do nothing;

-- Whether presenters can see their room, and a version number so two
-- people changing the board at once don't overwrite each other.
create table if not exists public.oral_room_settings (
  edition_id uuid primary key references public.editions (id) on delete cascade,
  published boolean not null default false,
  version int not null default 0,
  last_run jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.oral_room_settings enable row level security;
drop policy if exists "oral settings: signed in read" on public.oral_room_settings;
create policy "oral settings: signed in read" on public.oral_room_settings for select using (auth.uid() is not null);

-- How many talks each oral presentation session takes.
create table if not exists public.oral_rooms (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  capacity int check (capacity is null or capacity between 1 and 50),
  updated_at timestamptz not null default now()
);
alter table public.oral_rooms enable row level security;
drop policy if exists "oral rooms: signed in read" on public.oral_rooms;
create policy "oral rooms: signed in read" on public.oral_rooms for select using (auth.uid() is not null);

-- The oral presentation sessions in the current programme.
create or replace function public.oral_sessions()
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id from public.sessions s
   where s.edition_id = public.current_edition_id()
     and (s.slug like 'oral-presentation%' or s.title ilike 'oral presentation%')
$$;

-- 2026: five talks in the Isaac Newton Building, four in LMS0005.
insert into public.oral_rooms (session_id, capacity)
select s.id, case when s.slug like '%inb%' or s.title ilike '%newton%' then 5 when s.slug like '%lms%' or s.title ilike '%lms%' then 4 end
  from public.sessions s
 where s.id in (select public.oral_sessions())
on conflict (session_id) do nothing;

-- Where each oral presenter speaks. No session means not in a room yet
-- (or, when locked, kept out of the random allocation).
create table if not exists public.oral_allocations (
  edition_id uuid not null references public.editions (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  session_id uuid references public.sessions (id) on delete set null,
  position int not null default 0,
  locked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (edition_id, email)
);
create index if not exists oral_allocations_session_idx on public.oral_allocations (session_id, position);
alter table public.oral_allocations enable row level security;
drop policy if exists "oral allocations: allocators" on public.oral_allocations;
create policy "oral allocations: allocators" on public.oral_allocations for select using (public.has_access('allocate_orals'));

revoke insert, update, delete on public.oral_room_settings, public.oral_rooms, public.oral_allocations from anon, authenticated;

-- Everyone presenting an oral, with an account or only on the selected list.
create or replace function public.oral_presenter_people()
returns table (email text, user_id uuid, full_name text, institution text, title text, approved boolean, attendance text)
language sql stable security definer set search_path = public as $$
  select lower(p.email), p.id, coalesce(nullif(p.full_name, ''), p.email), p.institution,
         coalesce(nullif(p.presentation_title, ''),
                  (select s.title from public.presentation_submissions s where s.user_id = p.id and s.kind = 'slides' order by s.version desc limit 1)),
         p.account_status = 'approved',
         (select a.response from public.presenter_attendance a where a.user_id = p.id)
    from public.profiles p
   where public.has_access('allocate_orals')
     and p.account_status <> 'declined'
     and 'oral_presenter' = any(public.all_types(p.account_type, p.extra_types))
  union all
  select r.email, null, r.full_name, r.institution, r.presentation_title, false, null
    from public.delegate_roster r
   where public.has_access('allocate_orals')
     and 'oral_presenter' = any(public.all_types(r.account_type, r.extra_types))
     and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
$$;

-- Puts the rooms into each presenter's day (and the judges' list), or takes
-- them out again when the rooms are hidden. Called after every change.
create or replace function public.oral_sync()
returns void language plpgsql security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  shown boolean;
begin
  select published into shown from public.oral_room_settings where edition_id = ed;
  shown := coalesce(shown, false);

  -- Presenting in an oral room: only where the board says, and only once shown.
  delete from public.programme_assignments a
   where a.role = 'presenting'
     and a.session_id in (select public.oral_sessions())
     and (not shown or not exists (
       select 1 from public.oral_allocations o join public.profiles p on lower(p.email) = o.email
        where o.edition_id = ed and o.session_id = a.session_id and p.id = a.user_id));
  if not shown then return; end if;

  -- One room each: placing someone in one room takes them out of the other.
  delete from public.programme_assignments a
   using public.oral_allocations o, public.profiles p
   where o.edition_id = ed and o.session_id is not null and lower(p.email) = o.email and a.user_id = p.id
     and a.session_id in (select public.oral_sessions()) and a.session_id <> o.session_id;

  insert into public.programme_assignments (edition_id, user_id, session_id, role, note, created_by)
  select ed, p.id, o.session_id, 'presenting',
         'Talk ' || o.position || ' of ' || (select count(*) from public.oral_allocations x where x.edition_id = ed and x.session_id = o.session_id),
         auth.uid()
    from public.oral_allocations o
    join public.profiles p on lower(p.email) = o.email
   where o.edition_id = ed and o.session_id is not null
  on conflict (user_id, session_id) do update set role = 'presenting', note = excluded.note;

  -- Judges: the room and talk number, unless the committee wrote something else there.
  begin
    insert into public.judging_entries (presenter_id, kind, label, sort)
    select p.id, 'oral',
           left(coalesce(regexp_replace(rm.name, '\s*\([^)]*confirm[^)]*\)', '', 'i'), s.title) || ', talk ' || o.position, 80),
           (row_number() over (order by s.starts_at nulls last, s.sort, o.position))::int
      from public.oral_allocations o
      join public.profiles p on lower(p.email) = o.email
      join public.sessions s on s.id = o.session_id
      left join public.rooms rm on rm.id = s.room_id
     where o.edition_id = ed
    on conflict (presenter_id, kind) do update set label = excluded.label, sort = excluded.sort, updated_at = now()
     where public.judging_entries.label = '' or public.judging_entries.label ~ ', talk [0-9]+$';
  exception when undefined_table or undefined_column then null;
  end;
end $$;

-- The committee saves the whole board at once.
-- p_rows: [{"email": "...", "session_id": "..." or null, "position": 1, "locked": true}, ...]
-- p_version: the version the board was loaded at. Returns the new version.
create or replace function public.oral_allocation_save(p_version int, p_rows jsonb, p_run jsonb default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  cur int;
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  if ed is null then raise exception 'NO_EDITION'; end if;
  insert into public.oral_room_settings (edition_id) values (ed) on conflict do nothing;
  select version into cur from public.oral_room_settings where edition_id = ed for update;
  if p_version is not null and p_version <> cur then raise exception 'STALE'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) x
              where nullif(x->>'session_id', '') is not null
                and (x->>'session_id')::uuid not in (select public.oral_sessions())) then
    raise exception 'BAD_SESSION';
  end if;

  delete from public.oral_allocations where edition_id = ed;
  insert into public.oral_allocations (edition_id, email, session_id, position, locked)
  select ed, x.email, x.session_id,
         case when x.session_id is null then 0
              else row_number() over (partition by x.session_id order by x.pos, x.ord) end,
         x.locked
    from (
      select distinct on (lower(btrim(e->>'email')))
             lower(btrim(e->>'email')) as email,
             nullif(e->>'session_id', '')::uuid as session_id,
             coalesce(nullif(e->>'position', '')::int, 999) as pos,
             coalesce((e->>'locked')::boolean, false) as locked,
             o as ord
        from jsonb_array_elements(p_rows) with ordinality as t(e, o)
       where coalesce(e->>'email', '') like '%@%'
       order by lower(btrim(e->>'email')), o
    ) x;

  update public.oral_room_settings
     set version = version + 1, updated_at = now(), updated_by = auth.uid(),
         last_run = coalesce(p_run, last_run)
   where edition_id = ed
  returning version into cur;
  perform public.oral_sync();
  return cur;
end $$;

-- Show or hide the rooms to presenters.
create or replace function public.oral_settings_save(p_published boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id();
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  if p_published and not exists (select 1 from public.oral_allocations where edition_id = ed and session_id is not null) then
    raise exception 'NOTHING_TO_PUBLISH';
  end if;
  insert into public.oral_room_settings (edition_id, published, updated_at, updated_by)
  values (ed, p_published, now(), auth.uid())
  on conflict (edition_id) do update set published = excluded.published, updated_at = now(), updated_by = auth.uid();
  perform public.oral_sync();
end $$;

-- How many talks each room takes. p: [{"session_id": "...", "capacity": 5 or ""}, ...]
create or replace function public.oral_rooms_save(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  for r in select * from jsonb_array_elements(p) loop
    if (r->>'session_id')::uuid not in (select public.oral_sessions()) then raise exception 'BAD_SESSION'; end if;
    insert into public.oral_rooms (session_id, capacity, updated_at)
    values ((r->>'session_id')::uuid, nullif(r->>'capacity', '')::int, now())
    on conflict (session_id) do update set capacity = excluded.capacity, updated_at = now();
  end loop;
end $$;

-- A presenter's own room, once the committee shows it.
create or replace function public.my_oral_talk()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'session_id', o.session_id,
    'position', o.position,
    'of', (select count(*) from public.oral_allocations x where x.edition_id = o.edition_id and x.session_id = o.session_id))
    from public.oral_allocations o
    join public.oral_room_settings s on s.edition_id = o.edition_id and s.published
    join public.profiles p on p.id = auth.uid() and lower(p.email) = o.email
   where o.edition_id = public.current_edition_id() and o.session_id is not null
   limit 1
$$;

revoke all on function public.oral_sessions() from public, anon;
revoke all on function public.oral_presenter_people() from public, anon;
revoke all on function public.oral_sync() from public, anon, authenticated;
revoke all on function public.oral_allocation_save(int, jsonb, jsonb) from public, anon;
revoke all on function public.oral_settings_save(boolean) from public, anon;
revoke all on function public.oral_rooms_save(jsonb) from public, anon;
revoke all on function public.my_oral_talk() from public, anon;
grant execute on function public.oral_sessions() to authenticated;
grant execute on function public.oral_presenter_people() to authenticated;
grant execute on function public.oral_allocation_save(int, jsonb, jsonb) to authenticated;
grant execute on function public.oral_settings_save(boolean) to authenticated;
grant execute on function public.oral_rooms_save(jsonb) to authenticated;
grant execute on function public.my_oral_talk() to authenticated;
