-- =====================================================================
-- Oral presentation rooms, part 2: the audience.
--
--   * The two oral presentation rooms are in different buildings, too far
--     apart to swap between talks. So everyone else attending is placed in
--     one of the two rooms for the whole oral session, as well as the
--     speakers.
--   * On Committee dashboard > Oral presentation rooms, the committee
--     splits the audience at random (choosing which groups to include:
--     delegates and poster presenters, and optionally committee, judges and
--     speakers), in proportion to the seats in each room, or evenly when
--     the seats aren't set. They can move anyone by hand; anyone moved by
--     hand is locked and kept when splitting again.
--   * Once the committee shows the audience their rooms, each person sees
--     their room in My Hub and in their day, and the "where to go next"
--     alert sends them there. A place in an oral session the committee set
--     by hand on the On the day page (for example a judge) always wins.
--   * Needs 20261220000000_oral_presentation_rooms.sql first. Safe to run
--     more than once.
-- =====================================================================

alter table public.oral_room_settings add column if not exists audience_published boolean not null default false;
alter table public.oral_room_settings add column if not exists audience_version int not null default 0;
alter table public.oral_room_settings add column if not exists audience_last_run jsonb;
alter table public.oral_rooms add column if not exists seats int check (seats is null or seats between 1 and 2000);

-- Where each member of the audience sits. No session means not in a room
-- (or, when locked, kept out of the random split).
create table if not exists public.oral_audience (
  edition_id uuid not null references public.editions (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  session_id uuid references public.sessions (id) on delete set null,
  locked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (edition_id, email)
);
create index if not exists oral_audience_session_idx on public.oral_audience (session_id);
alter table public.oral_audience enable row level security;
drop policy if exists "oral audience: allocators" on public.oral_audience;
create policy "oral audience: allocators" on public.oral_audience for select using (public.has_access('allocate_orals'));
revoke insert, update, delete on public.oral_audience from anon, authenticated;

-- Everyone attending who isn't giving an oral talk, with the group they're in.
create or replace function public.oral_audience_people()
returns table (email text, user_id uuid, full_name text, institution text, grp text)
language sql stable security definer set search_path = public as $$
  with people as (
    select lower(p.email) as email, p.id as user_id, coalesce(nullif(p.full_name, ''), p.email) as full_name, p.institution,
           public.all_types(p.account_type, p.extra_types)::text[] as types
      from public.profiles p
     where p.account_status = 'approved'
    union all
    select r.email, null, r.full_name, r.institution, public.all_types(r.account_type, r.extra_types)::text[]
      from public.delegate_roster r
     where not exists (select 1 from public.profiles p where lower(p.email) = r.email)
  )
  select x.email, x.user_id, x.full_name, x.institution,
         case
           when exists (select 1 from unnest(x.types) t where t not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist', 'speaker', 'judge')) then 'committee'
           when 'judge' = any(x.types) then 'judge'
           when 'speaker' = any(x.types) then 'speaker'
           when 'poster_presenter' = any(x.types) or 'oral_waitlist' = any(x.types) then 'poster'
           else 'delegate'
         end
    from people x
   where public.has_access('allocate_orals')
     and not ('oral_presenter' = any(x.types))
$$;

-- Puts each person's room into their day, or takes it out when hidden.
-- Places made here carry this note, so they can be told apart from places
-- the committee set by hand, which are never touched.
create or replace function public.oral_audience_sync()
returns void language plpgsql security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  mark constant text := 'Your room for all the oral presentations';
  shown boolean;
begin
  select audience_published into shown from public.oral_room_settings where edition_id = ed;
  shown := coalesce(shown, false);

  delete from public.programme_assignments a
   where a.role = 'attending' and a.note = mark
     and a.session_id in (select public.oral_sessions())
     and (not shown or not exists (
       select 1 from public.oral_audience o join public.profiles p on lower(p.email) = o.email
        where o.edition_id = ed and o.session_id = a.session_id and p.id = a.user_id));
  if not shown then return; end if;

  insert into public.programme_assignments (edition_id, user_id, session_id, role, note, created_by)
  select ed, p.id, o.session_id, 'attending', mark, auth.uid()
    from public.oral_audience o
    join public.profiles p on lower(p.email) = o.email
   where o.edition_id = ed and o.session_id is not null
     -- Already placed in an oral session some other way (presenting, judging, helping): that wins.
     and not exists (select 1 from public.programme_assignments a
                      where a.user_id = p.id and a.session_id in (select public.oral_sessions())
                        and not (a.role = 'attending' and a.note = mark))
  on conflict (user_id, session_id) do nothing;
end $$;

-- The committee saves the whole audience at once (after a random split).
-- p_rows: [{"email": "...", "session_id": "..." or null, "locked": false}, ...]
create or replace function public.oral_audience_save(p_version int, p_rows jsonb, p_run jsonb default null)
returns int language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id(); cur int;
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  if ed is null then raise exception 'NO_EDITION'; end if;
  insert into public.oral_room_settings (edition_id) values (ed) on conflict do nothing;
  select audience_version into cur from public.oral_room_settings where edition_id = ed for update;
  if p_version is not null and p_version <> cur then raise exception 'STALE'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) x
              where nullif(x->>'session_id', '') is not null
                and (x->>'session_id')::uuid not in (select public.oral_sessions())) then
    raise exception 'BAD_SESSION';
  end if;
  delete from public.oral_audience where edition_id = ed;
  insert into public.oral_audience (edition_id, email, session_id, locked)
  select distinct on (lower(btrim(e->>'email'))) ed, lower(btrim(e->>'email')), nullif(e->>'session_id', '')::uuid, coalesce((e->>'locked')::boolean, false)
    from jsonb_array_elements(p_rows) with ordinality as t(e, o)
   where coalesce(e->>'email', '') like '%@%'
   order by lower(btrim(e->>'email')), o;
  update public.oral_room_settings
     set audience_version = audience_version + 1, updated_at = now(), updated_by = auth.uid(),
         audience_last_run = coalesce(p_run, audience_last_run)
   where edition_id = ed
  returning audience_version into cur;
  perform public.oral_audience_sync();
  return cur;
end $$;

-- The committee moves, locks or unlocks one person.
create or replace function public.oral_audience_set(p_email text, p_session uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id();
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  if coalesce(p_email, '') not like '%@%' then raise exception 'BAD_EMAIL'; end if;
  if p_session is not null and p_session not in (select public.oral_sessions()) then raise exception 'BAD_SESSION'; end if;
  insert into public.oral_audience (edition_id, email, session_id, locked, updated_at)
  values (ed, lower(btrim(p_email)), p_session, p_locked, now())
  on conflict (edition_id, email) do update set session_id = excluded.session_id, locked = excluded.locked, updated_at = now();
  perform public.oral_audience_sync();
end $$;

-- Show or hide the audience's rooms.
create or replace function public.oral_audience_publish(p_published boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id();
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  if p_published and not exists (select 1 from public.oral_audience where edition_id = ed and session_id is not null) then
    raise exception 'NOTHING_TO_PUBLISH';
  end if;
  insert into public.oral_room_settings (edition_id, audience_published, updated_at, updated_by)
  values (ed, p_published, now(), auth.uid())
  on conflict (edition_id) do update set audience_published = excluded.audience_published, updated_at = now(), updated_by = auth.uid();
  perform public.oral_audience_sync();
end $$;

-- Talks and seats in each room. p: [{"session_id": "...", "capacity": 5 or "", "seats": 120 or ""}, ...]
create or replace function public.oral_rooms_save(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.has_access('allocate_orals') then raise exception 'NOT_ALLOWED'; end if;
  for r in select * from jsonb_array_elements(p) loop
    if (r->>'session_id')::uuid not in (select public.oral_sessions()) then raise exception 'BAD_SESSION'; end if;
    insert into public.oral_rooms (session_id, capacity, seats, updated_at)
    values ((r->>'session_id')::uuid, nullif(r->>'capacity', '')::int, nullif(r->>'seats', '')::int, now())
    on conflict (session_id) do update
      set capacity = excluded.capacity,
          seats = case when r ? 'seats' then excluded.seats else public.oral_rooms.seats end,
          updated_at = now();
  end loop;
end $$;

-- A member of the audience's own room, once shown.
create or replace function public.my_oral_room()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('session_id', o.session_id)
    from public.oral_audience o
    join public.oral_room_settings s on s.edition_id = o.edition_id and s.audience_published
    join public.profiles p on p.id = auth.uid() and lower(p.email) = o.email
   where o.edition_id = public.current_edition_id() and o.session_id is not null
   limit 1
$$;

revoke all on function public.oral_audience_people() from public, anon;
revoke all on function public.oral_audience_sync() from public, anon, authenticated;
revoke all on function public.oral_audience_save(int, jsonb, jsonb) from public, anon;
revoke all on function public.oral_audience_set(text, uuid, boolean) from public, anon;
revoke all on function public.oral_audience_publish(boolean) from public, anon;
revoke all on function public.oral_rooms_save(jsonb) from public, anon;
revoke all on function public.my_oral_room() from public, anon;
grant execute on function public.oral_audience_people() to authenticated;
grant execute on function public.oral_audience_save(int, jsonb, jsonb) to authenticated;
grant execute on function public.oral_audience_set(text, uuid, boolean) to authenticated;
grant execute on function public.oral_audience_publish(boolean) to authenticated;
grant execute on function public.oral_rooms_save(jsonb) to authenticated;
grant execute on function public.my_oral_room() to authenticated;
