-- =====================================================================
-- Staff accounts: keynote speakers, workshop leads and judges.
--
-- Staff are the "speaker" and "judge" account types (a workshop lead is
-- set up as a speaker). Someone who is only staff, with no delegate,
-- presenter or committee role alongside it:
--   * can use the on-the-day scanner and the judging portal,
--   * isn't invited to the research study (no prompt, no reminders),
--   * doesn't see the network list (handled in the website).
-- Their Delegate Card and QR code work like everyone else's.
--
-- Safe to run more than once.
-- =====================================================================

update public.access_rules
   set allowed = true
 where account_type::text in ('speaker', 'judge')
   and capability in ('day_scanner', 'judge_presentations');

create or replace function public.research_eligible(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.account_status in ('approved', 'waitlisted')
       and not (public.all_types(p.account_type, p.extra_types) <@ array['speaker', 'judge']::public.account_type[])
      from public.profiles p where p.id = p_id
  ), false)
$$;
revoke all on function public.research_eligible(uuid) from public, anon, authenticated;
