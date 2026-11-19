-- Research study: automatic email reminders.
--
-- Called by the website on a schedule (service role only). Returns who to
-- email now and records that they were emailed, in one step:
--   * invite:   eligible people who haven't answered the invitation yet,
--               while the first questionnaire is open. Every 2 days, then
--               every 12 hours in the last 24 hours before it closes.
--   * pre/post/followup: participants who agreed to reminders and haven't
--               done an open questionnaire. Every 2 days.
-- Nothing is sent while the study is switched off. Safe to run more than once.

create table if not exists public.research_invite_nudges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null,
  sent int not null default 1
);
alter table public.research_invite_nudges enable row level security;
revoke all on public.research_invite_nudges from public, anon, authenticated;

create or replace function public.research_due_reminders()
returns table (user_id uuid, email text, full_name text, kind text, closes_at timestamptz)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  s public.research_study;
  gap interval;
  st text;
  opens timestamptz;
  closes timestamptz;
begin
  select * into s from public.research_study where id = 1;
  if not found or not s.enabled or s.anonymised_at is not null then return; end if;

  -- Invitations, while people can still join.
  if s.pre_closes_at is not null and now() < s.pre_closes_at then
    gap := case when s.pre_closes_at - now() <= interval '24 hours' then interval '12 hours' else interval '2 days' end;
    return query
      with due as (
        select p.id, p.email, p.full_name from public.profiles p
         where public.research_eligible(p.id) and p.email is not null
           and not exists (select 1 from public.research_enrolments e where e.user_id = p.id)
           and not exists (select 1 from public.research_invite_nudges n where n.user_id = p.id and n.last_sent_at > now() - gap)
      ), marked as (
        insert into public.research_invite_nudges as n (user_id, last_sent_at)
        select id, now() from due
        on conflict (user_id) do update set last_sent_at = now(), sent = n.sent + 1
        returning n.user_id
      )
      select d.id, d.email, d.full_name, 'invite'::text, s.pre_closes_at from due d join marked m on m.user_id = d.id;
  end if;

  -- Open questionnaires, for participants who agreed to reminders.
  foreach st in array array['pre', 'post', 'followup'] loop
    opens := case st when 'pre' then null when 'post' then s.post_opens_at else s.followup_opens_at end;
    closes := case st when 'pre' then s.pre_closes_at when 'post' then s.post_closes_at else s.followup_closes_at end;
    continue when closes is null or now() >= closes or (opens is not null and now() < opens);
    return query
      with due as (
        select e.participant_code, e.user_id from public.research_enrolments e
         where e.decision = 'consented' and e.withdrawn_at is null and e.consent_contact and e.user_id is not null
           and not exists (select 1 from public.research_responses r where r.participant_code = e.participant_code and r.stage = st)
           and (st = 'pre' or exists (select 1 from public.research_responses r where r.participant_code = e.participant_code and r.stage = 'pre'))
           and coalesce((e.last_reminded ->> st)::timestamptz, '-infinity') < now() - interval '2 days'
      ), marked as (
        update public.research_enrolments x set last_reminded = x.last_reminded || jsonb_build_object(st, now())
          from due where x.participant_code = due.participant_code
        returning x.user_id
      )
      select p.id, p.email, p.full_name, st, closes from marked m join public.profiles p on p.id = m.user_id where p.email is not null;
  end loop;
end $$;
revoke all on function public.research_due_reminders() from public, anon, authenticated;
grant execute on function public.research_due_reminders() to service_role;
