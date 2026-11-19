-- Research study: invite everyone with an approved or waitlisted account.
--
-- Previously the organising committee, speakers and judges were left out.
-- They are now invited too, and say so in the "role" question (option
-- "organiser"), so they can be excluded from the main analysis.
-- Safe to run more than once.

create or replace function public.research_eligible(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.account_status in ('approved', 'waitlisted')
      from public.profiles p where p.id = p_id
  ), false)
$$;
revoke all on function public.research_eligible(uuid) from public, anon, authenticated;
