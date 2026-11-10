-- =====================================================================
-- Show the selected delegate list before people have set up accounts.
--
--   * Committee members who can review accounts see everyone on the
--     selected list in the network, marked "not joined yet", so the
--     network is never empty while invitations go out.
--   * Delegates only ever see people who have joined, because only those
--     people have seen the privacy notice and can hide their own card.
--     They see a count of how many more are still to join.
-- =====================================================================

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
      from public.profiles p where p.id = auth.uid()
  ), people as (
    select p.id::text, p.full_name, p.institution, p.year_of_study, p.account_type,
           case when p.account_type in ('supporting_committee', 'executive_committee', 'vice_president', 'president') then p.committee_position end,
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

-- How many selected people haven't set up an account yet. Numbers only.
create or replace function public.selected_waiting_count()
returns integer language sql stable security definer set search_path = public as $$
  select case when exists (
           select 1 from public.profiles me where me.id = auth.uid()
              and (me.account_status = 'approved' or me.role = 'admin' or public.has_access('review_accounts'))
         )
         then (select count(*)::int from public.delegate_roster r
                where not exists (select 1 from public.profiles p where lower(p.email) = r.email))
         else 0 end
$$;
revoke all on function public.selected_waiting_count() from public, anon;
grant execute on function public.selected_waiting_count() to authenticated;
