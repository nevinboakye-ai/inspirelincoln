-- =====================================================================
-- University logos.
--
--   * Committee members who can edit the website can add a logo for each
--     university that delegates come from. Logos are saved in the public
--     "media" folder (under universities/), like other website images.
--   * The logo shows next to the university on Delegate Cards, scanned
--     cards and the delegate network. Universities without a logo show a
--     small badge with their initials instead.
--   * University names are matched ignoring capitals and spaces at either
--     end, exactly as people typed them in their profile.
-- =====================================================================

create table if not exists public.university_logos (
  institution_key text primary key check (institution_key = lower(btrim(institution_key)) and institution_key <> ''),
  institution text not null,
  path text not null check (path ~ '^universities/[a-z0-9-]+\.(png|jpg|webp)$'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.university_logos enable row level security;

drop policy if exists "university logos: anyone reads" on public.university_logos;
create policy "university logos: anyone reads" on public.university_logos for select using (true);
drop policy if exists "university logos: editors write" on public.university_logos;
create policy "university logos: editors write" on public.university_logos for all
  using (public.is_editor()) with check (public.is_editor());

-- Every university delegates have given, with how many people and its logo.
create or replace function public.university_list()
returns table (institution text, people bigint, path text)
language sql stable security definer set search_path = public as $$
  with names as (
    select btrim(institution) as institution from public.profiles where institution is not null and btrim(institution) <> ''
    union all
    select btrim(institution) from public.delegate_roster where institution is not null and btrim(institution) <> ''
  ), grouped as (
    select lower(institution) as k, mode() within group (order by institution) as institution, count(*) as people
      from names group by lower(institution)
  )
  select g.institution, g.people, l.path
    from grouped g
    left join public.university_logos l on l.institution_key = g.k
   where public.is_editor()
   order by g.people desc, g.institution
$$;
revoke all on function public.university_list() from public, anon;
grant execute on function public.university_list() to authenticated;
