-- Part 2 of 2: the four teams start with the same permissions as the supporting
-- committee. The owner can change each one separately in the Platform dashboard.
insert into public.access_rules (account_type, capability, allowed)
select t.team::public.account_type, r.capability, r.allowed
  from unnest(array['academic_team', 'publicity_team', 'finance_team', 'logistics_team']) as t(team)
  join public.access_rules r on r.account_type = 'supporting_committee'
on conflict do nothing;

-- Show committee positions for every committee account, including the teams.
drop function if exists public.network_directory();
create function public.network_directory()
returns table (
  id text, full_name text, institution text, year_of_study text, account_type public.account_type,
  committee_position text, bio text, linkedin_url text, email text, joined boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select (p.account_status = 'approved' or p.role = 'admin') as member,
           public.has_access('review_accounts') as staff
      from public.profiles p
     where p.id = auth.uid() and (public.network_is_open() or public.is_site_owner())
  ), people as (
    select p.id::text, p.full_name, p.institution, p.year_of_study, p.account_type,
           case when p.account_type not in ('delegate', 'oral_presenter', 'poster_presenter') then p.committee_position end,
           p.bio, p.linkedin_url,
           case when p.network_show_email then p.email end,
           true
      from public.profiles p, me
     where (me.member or me.staff)
       and p.network_listed and p.account_status = 'approved' and p.full_name is not null
    union all
    select 'selected:' || md5(r.email), r.full_name, r.institution, r.year_of_study, r.account_type,
           null, null, null, null, false
      from public.delegate_roster r, me
     where me.staff
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
  )
  select * from people order by lower(full_name)
$$;
revoke all on function public.network_directory() from public, anon;
grant execute on function public.network_directory() to authenticated;
