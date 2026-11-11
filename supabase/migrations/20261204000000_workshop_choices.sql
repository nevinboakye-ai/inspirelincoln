-- =====================================================================
-- Workshop choices.
--
--   * The six workshops run in three sessions, two at a time: 1A and 1B,
--     2A and 2B, 3A and 3B. The committee sets which workshops pair up and
--     how many people each room holds.
--   * While ranking is open, confirmed delegates put all six workshops in
--     order of preference from My Hub. They can change their order until
--     ranking closes.
--   * The committee then runs the allocation, which gives everyone one
--     workshop in each session, as close to their ranking as the rooms
--     allow. They can move people by hand, then publish the results, and
--     each delegate sees their three workshops in My Hub.
--   * Only the committee members with the new "Workshop places" permission
--     (by default the executive committee, vice president and president)
--     can see everyone's choices and places. Each delegate sees their own.
--   * Every change goes through the functions below, which check who is
--     asking. Nobody can write to the tables directly. Choices and places
--     are deleted with the account.
-- =====================================================================

insert into public.access_capabilities (key, label, description, sort) values
  ('allocate_workshops', 'Workshop places', 'Open and close workshop ranking, set room sizes, run the allocation and publish it.', 57)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'allocate_workshops',
       t.account_type in ('executive_committee', 'vice_president', 'president')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

-- Which session each workshop runs in, and whether it's A or B.
alter table public.workshops add column if not exists slot smallint;
alter table public.workshops add column if not exists stream text;
alter table public.workshops drop constraint if exists workshops_slot_check;
alter table public.workshops add constraint workshops_slot_check check (slot is null or slot between 1 and 3);
alter table public.workshops drop constraint if exists workshops_stream_check;
alter table public.workshops add constraint workshops_stream_check check (stream is null or stream in ('a', 'b'));
create unique index if not exists workshops_slot_stream_idx on public.workshops (edition_id, slot, stream) where slot is not null and stream is not null;

create or replace function public.current_edition_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.editions where is_current limit 1
$$;

-- Open or closed, closing time, and whether results are out.
create table if not exists public.workshop_choice_settings (
  edition_id uuid primary key references public.editions (id) on delete cascade,
  ranking_open boolean not null default false,
  closes_at timestamptz,
  results_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.workshop_choice_settings enable row level security;
drop policy if exists "workshop settings: signed in read" on public.workshop_choice_settings;
create policy "workshop settings: signed in read" on public.workshop_choice_settings for select using (auth.uid() is not null);

-- Each person's order of preference, most wanted first.
create table if not exists public.workshop_rankings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  edition_id uuid not null references public.editions (id) on delete cascade,
  ranking uuid[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, edition_id)
);
alter table public.workshop_rankings enable row level security;
drop policy if exists "workshop rankings: own or allocators" on public.workshop_rankings;
create policy "workshop rankings: own or allocators" on public.workshop_rankings for select
  using (user_id = auth.uid() or public.has_access('allocate_workshops'));

-- Where each person goes in each session. "choice" is where they ranked it.
create table if not exists public.workshop_allocations (
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  workshop_id uuid not null references public.workshops (id) on delete cascade,
  choice smallint check (choice between 1 and 6),
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (edition_id, user_id, slot)
);
create index if not exists workshop_allocations_workshop_idx on public.workshop_allocations (workshop_id);
alter table public.workshop_allocations enable row level security;
drop policy if exists "workshop allocations: own once published, or allocators" on public.workshop_allocations;
create policy "workshop allocations: own once published, or allocators" on public.workshop_allocations for select using (
  public.has_access('allocate_workshops')
  or (user_id = auth.uid() and exists (
    select 1 from public.workshop_choice_settings s where s.edition_id = workshop_allocations.edition_id and s.results_published))
);

-- A record of each run, for the committee.
create table if not exists public.workshop_allocation_runs (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  ran_at timestamptz not null default now(),
  ran_by uuid references public.profiles (id) on delete set null,
  summary jsonb not null default '{}'
);
alter table public.workshop_allocation_runs enable row level security;
drop policy if exists "workshop runs: allocators" on public.workshop_allocation_runs;
create policy "workshop runs: allocators" on public.workshop_allocation_runs for select using (public.has_access('allocate_workshops'));

revoke insert, update, delete on public.workshop_choice_settings, public.workshop_rankings, public.workshop_allocations, public.workshop_allocation_runs from anon, authenticated;

-- A delegate saves their ranking.
create or replace function public.workshop_ranking_save(p_ranking uuid[])
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  s public.workshop_choice_settings;
  expected uuid[];
  saved timestamptz;
begin
  if auth.uid() is null then raise exception 'SIGN_IN'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and (p.account_status = 'approved' or p.role = 'admin')) then
    raise exception 'NOT_CONFIRMED';
  end if;
  select * into s from public.workshop_choice_settings where edition_id = ed;
  if s.edition_id is null or not s.ranking_open or (s.closes_at is not null and now() >= s.closes_at) then
    raise exception 'RANKING_CLOSED';
  end if;
  select array_agg(id order by id) into expected from public.workshops where edition_id = ed and published;
  if p_ranking is null or cardinality(p_ranking) <> cardinality(expected)
     or (select array_agg(x order by x) from unnest(p_ranking) x) is distinct from expected then
    raise exception 'BAD_RANKING';
  end if;
  insert into public.workshop_rankings (user_id, edition_id, ranking) values (auth.uid(), ed, p_ranking)
  on conflict (user_id, edition_id) do update set ranking = excluded.ranking, updated_at = now()
  returning updated_at into saved;
  return saved;
end $$;

-- The committee opens or closes ranking, and publishes results.
create or replace function public.workshop_settings_save(p_open boolean, p_closes_at timestamptz, p_publish boolean)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id();
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  if p_publish and not exists (select 1 from public.workshop_allocations where edition_id = ed) then raise exception 'NOTHING_TO_PUBLISH'; end if;
  insert into public.workshop_choice_settings (edition_id, ranking_open, closes_at, results_published, updated_at, updated_by)
  values (ed, p_open, p_closes_at, p_publish, now(), auth.uid())
  on conflict (edition_id) do update set ranking_open = excluded.ranking_open, closes_at = excluded.closes_at,
    results_published = excluded.results_published, updated_at = now(), updated_by = auth.uid();
end $$;

-- The committee sets which session each workshop runs in, A or B, and room sizes.
-- p: [{"id": "...", "slot": 1, "stream": "a", "capacity": 40}, ...]
create or replace function public.workshop_sessions_save(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id(); r jsonb;
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  -- Clear first, so swapping two workshops doesn't trip the one-per-place rule.
  update public.workshops set slot = null, stream = null
   where edition_id = ed and id in (select (x->>'id')::uuid from jsonb_array_elements(p) x);
  for r in select * from jsonb_array_elements(p) loop
    update public.workshops
       set slot = nullif(r->>'slot', '')::smallint,
           stream = nullif(r->>'stream', ''),
           capacity = nullif(r->>'capacity', '')::int
     where id = (r->>'id')::uuid and edition_id = ed;
  end loop;
end $$;

-- The committee saves a new allocation, replacing the last one.
-- p_rows: [{"user_id": "...", "slot": 1, "workshop_id": "...", "choice": 2}, ...]
create or replace function public.workshop_allocation_replace(p_rows jsonb, p_summary jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id(); run uuid;
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  delete from public.workshop_allocations where edition_id = ed;
  insert into public.workshop_allocations (edition_id, user_id, slot, workshop_id, choice)
  select ed, (x->>'user_id')::uuid, (x->>'slot')::smallint, (x->>'workshop_id')::uuid, nullif(x->>'choice', '')::smallint
    from jsonb_array_elements(p_rows) x
    join public.workshops w on w.id = (x->>'workshop_id')::uuid and w.edition_id = ed and w.slot = (x->>'slot')::smallint;
  insert into public.workshop_allocation_runs (edition_id, ran_by, summary) values (ed, auth.uid(), coalesce(p_summary, '{}'))
  returning id into run;
  return run;
end $$;

-- The committee moves one person to the other workshop in a session.
create or replace function public.workshop_allocation_move(p_user uuid, p_workshop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id(); w public.workshops; rk uuid[];
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  select * into w from public.workshops where id = p_workshop and edition_id = ed;
  if w.id is null or w.slot is null then raise exception 'NO_SESSION'; end if;
  select ranking into rk from public.workshop_rankings where user_id = p_user and edition_id = ed;
  insert into public.workshop_allocations (edition_id, user_id, slot, workshop_id, choice, manual)
  values (ed, p_user, w.slot, w.id, array_position(rk, w.id), true)
  on conflict (edition_id, user_id, slot) do update
    set workshop_id = excluded.workshop_id, choice = excluded.choice, manual = true;
end $$;

-- Everyone with a confirmed place, with their ranking if they've given one.
create or replace function public.workshop_choice_people()
returns table (user_id uuid, full_name text, email text, institution text, committee boolean, ranking uuid[], ranked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.institution,
         exists (select 1 from unnest(public.all_types(p.account_type, p.extra_types)) t
                  where t not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')),
         r.ranking, r.updated_at
    from public.profiles p
    left join public.workshop_rankings r on r.user_id = p.id and r.edition_id = public.current_edition_id()
   where public.has_access('allocate_workshops')
     and (p.account_status = 'approved' or r.user_id is not null)
   order by lower(coalesce(p.full_name, p.email))
$$;

revoke all on function public.workshop_ranking_save(uuid[]) from public, anon;
revoke all on function public.workshop_settings_save(boolean, timestamptz, boolean) from public, anon;
revoke all on function public.workshop_sessions_save(jsonb) from public, anon;
revoke all on function public.workshop_allocation_replace(jsonb, jsonb) from public, anon;
revoke all on function public.workshop_allocation_move(uuid, uuid) from public, anon;
revoke all on function public.workshop_choice_people() from public, anon;
grant execute on function public.workshop_ranking_save(uuid[]) to authenticated;
grant execute on function public.workshop_settings_save(boolean, timestamptz, boolean) to authenticated;
grant execute on function public.workshop_sessions_save(jsonb) to authenticated;
grant execute on function public.workshop_allocation_replace(jsonb, jsonb) to authenticated;
grant execute on function public.workshop_allocation_move(uuid, uuid) to authenticated;
grant execute on function public.workshop_choice_people() to authenticated;
