-- Part 2 of 2: the oral waiting list is attending as a delegate, so it gets no
-- committee permissions, can be put on the selected list, and is treated like
-- the other delegate types everywhere.
insert into public.access_rules (account_type, capability, allowed)
select 'oral_waitlist'::public.account_type, c.key, false
  from public.access_capabilities c
on conflict do nothing;

alter table public.delegate_roster drop constraint if exists delegate_roster_account_type_check;
alter table public.delegate_roster add constraint delegate_roster_account_type_check
  check (account_type in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist'));

-- Selected-list entries can now move someone onto or off the waiting list.
create or replace function public.apply_roster_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('inspire.roster_apply', 'on', true);
  update public.profiles p
     set account_status = 'approved',
         account_type = case when p.account_type in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist') then new.account_type else p.account_type end,
         full_name = coalesce(p.full_name, new.full_name),
         institution = coalesce(p.institution, new.institution),
         year_of_study = coalesce(p.year_of_study, new.year_of_study),
         presentation_title = coalesce(p.presentation_title, new.presentation_title),
         review_note = coalesce(p.review_note, 'On the selected delegate list'),
         reviewed_at = coalesce(p.reviewed_at, now())
   where lower(p.email) = new.email
     and p.account_status in ('pending', 'waitlisted');
  perform set_config('inspire.roster_apply', 'off', true);
  return new;
end $$;

-- Committee positions only for committee accounts.
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
           case when p.account_type not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist') then p.committee_position end,
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
