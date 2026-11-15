-- =====================================================================
-- Judges and speakers are guests, not committee.
--
-- The on-the-day scanner (setup file 42) and direct messages (setup file
-- 43) were written before judge and speaker accounts existed (setup files
-- 44 and 45). Depending on the order those files ran in, judges and
-- speakers could be given the scanner, committee messaging, and
-- committee-only on-screen alerts. This puts them back to what the
-- judging portal expects: neither of those permissions, and not counted
-- as committee. The site owner can still switch either on per person.
--
-- Needs setup files 41 to 45. Safe to run more than once.
-- =====================================================================

update public.access_rules
   set allowed = false
 where account_type::text in ('speaker', 'judge')
   and capability in ('day_scanner', 'message_people');

create or replace function public.is_committee_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.account_status = 'approved' and exists (
             select 1 from unnest(public.all_types(p.account_type, p.extra_types)) r
              where r::text not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist', 'speaker', 'judge'))
      from public.profiles p where p.id = auth.uid()
  ), false) or public.is_site_owner()
$$;
