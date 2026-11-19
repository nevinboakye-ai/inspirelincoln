-- =====================================================================
-- The INSPIRE research study (setup file 50).
--
-- A three-stage questionnaire study (before, after and eight weeks after
-- the conference) that delegates can choose to join from My Hub.
--
--   research_study        One row of settings. Off until the ethics
--                         approval and data governance are recorded; the
--                         database refuses to switch it on before then.
--   research_enrolments   Each person's decision (take part or not), their
--                         random study code and consent choices. This is
--                         the only place a code is linked to an account.
--   research_responses    Answers, stored under the study code only. One
--                         per person per questionnaire.
--
-- Nobody reads the research tables directly: every read and write goes
-- through the functions below, which check who is asking. Answers can be
-- read only by people with the new "Research data" permission, which is
-- off for every account type (the site owner always has it), so the wider
-- committee never sees individual answers. Exports carry the study code,
-- never a name, email or account id.
--
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- The permission
-- ---------------------------------------------------------------------
insert into public.access_capabilities (key, label, description, sort) values
  ('research_data', 'Research study', 'Run the research study: its settings and switch, response numbers, reminders and the de-identified data export. Give it only to the named research team.', 70)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type, 'research_data', false
  from (select unnest(enum_range(null::public.account_type)) as account_type) t
on conflict (account_type, capability) do nothing;

create or replace function public.can_run_research()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('research_data')
$$;
revoke all on function public.can_run_research() from public, anon;
grant execute on function public.can_run_research() to authenticated;

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
create table if not exists public.research_study (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  ethics_committee text,
  ethics_reference text,
  ethics_approved_on date,
  governance_confirmed boolean not null default false,
  lead_name text,
  lead_email text check (lead_email is null or lead_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  protocol_version text not null default '1.0',
  info_version text not null default '1.0',
  event_date date not null default '2026-11-21',
  pre_closes_at timestamptz default '2026-11-21 09:00:00+00',
  post_opens_at timestamptz default '2026-11-21 15:15:00+00',
  post_closes_at timestamptz default '2026-12-05 23:59:00+00',
  followup_opens_at timestamptz default '2027-01-09 09:00:00+00',
  followup_closes_at timestamptz default '2027-01-30 23:59:00+00',
  anonymised_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  -- The study can't be switched on until approval and governance are recorded.
  constraint research_on_needs_approval check (
    not enabled or (
      coalesce(btrim(ethics_committee), '') <> '' and coalesce(btrim(ethics_reference), '') <> ''
      and ethics_approved_on is not null and governance_confirmed
      and coalesce(btrim(lead_name), '') <> '' and lead_email is not null
      and pre_closes_at <= post_opens_at and post_opens_at < post_closes_at
      and post_closes_at <= followup_opens_at and followup_opens_at < followup_closes_at
      and anonymised_at is null
    )
  )
);
insert into public.research_study (id) values (1) on conflict do nothing;

alter table public.research_study enable row level security;
drop policy if exists "research study: signed in read" on public.research_study;
drop policy if exists "research study: research team writes" on public.research_study;
-- Participants need the windows and the lead researcher's contact details.
create policy "research study: signed in read" on public.research_study for select to authenticated using (true);
create policy "research study: research team writes" on public.research_study for update to authenticated
  using (public.can_run_research()) with check (public.can_run_research());

-- ---------------------------------------------------------------------
-- Enrolments and responses
-- ---------------------------------------------------------------------
create or replace function public.new_research_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  -- No 0/O or 1/I/L, so codes can be read out.
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'IN-';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.research_enrolments where participant_code = c);
  end loop;
  return c;
end $$;

create table if not exists public.research_enrolments (
  participant_code text primary key,
  -- Cleared when the data are anonymised, or if the account is deleted.
  user_id uuid unique references auth.users(id) on delete set null,
  decision text not null check (decision in ('consented', 'declined')),
  decided_at timestamptz not null default now(),
  consent_version text,
  consent_contact boolean not null default false,
  consent_linkage boolean not null default false,
  consent_sharing boolean not null default false,
  withdrawn_at timestamptz,
  withdrawal text check (withdrawal is null or withdrawal in ('no_further', 'delete')),
  last_reminded jsonb not null default '{}'::jsonb
);

create table if not exists public.research_responses (
  id bigint generated always as identity primary key,
  participant_code text not null references public.research_enrolments(participant_code) on delete cascade,
  stage text not null check (stage in ('pre', 'post', 'followup')),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  instrument_version text not null,
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  -- One per person per questionnaire: no duplicates.
  unique (participant_code, stage)
);

alter table public.research_enrolments enable row level security;
alter table public.research_responses enable row level security;
-- No policies: nobody reads or writes these tables directly.
revoke all on public.research_enrolments from anon, authenticated;
revoke all on public.research_responses from anon, authenticated;

-- ---------------------------------------------------------------------
-- Who is invited: delegates and presenters (approved or on the waiting
-- list), not the committee, speakers or judges, who run the day.
-- ---------------------------------------------------------------------
create or replace function public.research_eligible(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.account_status in ('approved', 'waitlisted')
       and public.all_types(p.account_type, p.extra_types)
           && array['delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist']::public.account_type[]
       and not (public.all_types(p.account_type, p.extra_types)
           && array['speaker', 'judge', 'supporting_committee', 'academic_team', 'publicity_team', 'finance_team',
                    'logistics_team', 'executive_committee', 'vice_president', 'president']::public.account_type[])
      from public.profiles p where p.id = p_id
  ), false)
$$;
revoke all on function public.research_eligible(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- For participants
-- ---------------------------------------------------------------------

-- Where the signed-in person stands.
create or replace function public.research_my_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'eligible', public.research_eligible(auth.uid()),
    'decision', e.decision,
    'code', case when e.decision = 'consented' then e.participant_code end,
    'decided_at', e.decided_at,
    'consent_contact', coalesce(e.consent_contact, false),
    'consent_linkage', coalesce(e.consent_linkage, false),
    'consent_sharing', coalesce(e.consent_sharing, false),
    'withdrawn_at', e.withdrawn_at,
    'withdrawal', e.withdrawal,
    'done', coalesce((select jsonb_agg(r.stage order by r.submitted_at) from public.research_responses r where r.participant_code = e.participant_code), '[]'::jsonb)
  )
  from (select 1) one
  left join public.research_enrolments e on e.user_id = auth.uid()
$$;
revoke all on function public.research_my_status() from public, anon;
grant execute on function public.research_my_status() to authenticated;

-- Take part or say no thanks. Saying no can be changed to yes while the
-- first questionnaire is open; nobody can rejoin after withdrawing.
create or replace function public.research_decide(p_decision text, p_consent_version text default null, p_contact boolean default false, p_linkage boolean default false, p_sharing boolean default false)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  s public.research_study;
  e public.research_enrolments;
begin
  select * into s from public.research_study where id = 1;
  if not coalesce(s.enabled, false) then raise exception 'The research study is not running' using errcode = 'P0001'; end if;
  if not public.research_eligible(auth.uid()) then raise exception 'This study is for delegates and presenters' using errcode = 'P0001'; end if;
  if p_decision not in ('consented', 'declined') then raise exception 'Unknown choice' using errcode = '22023'; end if;
  select * into e from public.research_enrolments where user_id = auth.uid();
  if e.withdrawn_at is not null then raise exception 'You have withdrawn from the study' using errcode = 'P0001'; end if;
  if e.decision = 'consented' then
    if p_decision = 'consented' then return e.participant_code; end if;
    raise exception 'To stop taking part, withdraw from the study page' using errcode = 'P0001';
  end if;
  if p_decision = 'consented' then
    if now() > s.pre_closes_at then raise exception 'The study closed to new participants when the conference began' using errcode = 'P0001'; end if;
    if coalesce(btrim(p_consent_version), '') = '' then raise exception 'Consent version missing' using errcode = '22023'; end if;
  end if;
  insert into public.research_enrolments as x (participant_code, user_id, decision, decided_at, consent_version, consent_contact, consent_linkage, consent_sharing)
  values (public.new_research_code(), auth.uid(), p_decision, now(),
          case when p_decision = 'consented' then p_consent_version end,
          p_decision = 'consented' and coalesce(p_contact, false),
          p_decision = 'consented' and coalesce(p_linkage, false),
          p_decision = 'consented' and coalesce(p_sharing, false))
  on conflict (user_id) do update set
    decision = excluded.decision, decided_at = excluded.decided_at, consent_version = excluded.consent_version,
    consent_contact = excluded.consent_contact, consent_linkage = excluded.consent_linkage, consent_sharing = excluded.consent_sharing
  returning x.* into e;
  return case when e.decision = 'consented' then e.participant_code end;
end $$;
revoke all on function public.research_decide(text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.research_decide(text, text, boolean, boolean, boolean) to authenticated;

-- Change the optional consent choices (contact, linkage, sharing).
create or replace function public.research_update_consent(p_contact boolean, p_linkage boolean, p_sharing boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update public.research_enrolments
     set consent_contact = coalesce(p_contact, false), consent_linkage = coalesce(p_linkage, false), consent_sharing = coalesce(p_sharing, false)
   where user_id = auth.uid() and decision = 'consented' and withdrawn_at is null;
  if not found then raise exception 'You are not taking part in the study' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.research_update_consent(boolean, boolean, boolean) from public, anon;
grant execute on function public.research_update_consent(boolean, boolean, boolean) to authenticated;

-- Submit one questionnaire. The website checks every answer against the
-- questionnaire first; this checks who, when and that it's the first time.
create or replace function public.research_submit(p_stage text, p_answers jsonb, p_version text, p_started_at timestamptz default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  s public.research_study;
  e public.research_enrolments;
  opens timestamptz;
  closes timestamptz;
begin
  select * into s from public.research_study where id = 1;
  if not coalesce(s.enabled, false) then raise exception 'The research study is not running' using errcode = 'P0001'; end if;
  select * into e from public.research_enrolments where user_id = auth.uid();
  if e.decision is distinct from 'consented' then raise exception 'You are not taking part in the study' using errcode = 'P0001'; end if;
  if e.withdrawn_at is not null then raise exception 'You have withdrawn from the study' using errcode = 'P0001'; end if;
  if p_stage = 'pre' then opens := null; closes := s.pre_closes_at;
  elsif p_stage = 'post' then opens := s.post_opens_at; closes := s.post_closes_at;
  elsif p_stage = 'followup' then opens := s.followup_opens_at; closes := s.followup_closes_at;
  else raise exception 'Unknown questionnaire' using errcode = '22023';
  end if;
  -- A few minutes' grace for someone who started just before the close.
  if (opens is not null and now() < opens) or closes is null or now() > closes + interval '15 minutes' then
    raise exception 'This questionnaire is not open' using errcode = 'P0001';
  end if;
  if p_stage <> 'pre' and not exists (select 1 from public.research_responses r where r.participant_code = e.participant_code and r.stage = 'pre') then
    raise exception 'The first questionnaire was not completed' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or octet_length(p_answers::text) > 20000 then
    raise exception 'Answers are not valid' using errcode = '22023';
  end if;
  insert into public.research_responses (participant_code, stage, answers, instrument_version, started_at)
  values (e.participant_code, p_stage, p_answers, coalesce(nullif(btrim(p_version), ''), 'unknown'),
          case when p_started_at between now() - interval '1 day' and now() then p_started_at end);
exception
  when unique_violation then raise exception 'You have already completed this questionnaire' using errcode = 'P0001';
end $$;
revoke all on function public.research_submit(text, jsonb, text, timestamptz) from public, anon;
grant execute on function public.research_submit(text, jsonb, text, timestamptz) to authenticated;

-- Withdraw: stop (keep answers already given) or delete everything given so
-- far. Deletion is possible until the data are anonymised.
create or replace function public.research_withdraw(p_delete boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  e public.research_enrolments;
begin
  select * into e from public.research_enrolments where user_id = auth.uid() and decision = 'consented';
  if not found then raise exception 'You are not taking part in the study' using errcode = 'P0001'; end if;
  if coalesce(p_delete, false) then
    delete from public.research_responses where participant_code = e.participant_code;
  end if;
  update public.research_enrolments
     set withdrawn_at = coalesce(withdrawn_at, now()),
         withdrawal = case when coalesce(p_delete, false) then 'delete' else coalesce(withdrawal, 'no_further') end,
         consent_contact = false, consent_linkage = false, consent_sharing = false
   where participant_code = e.participant_code;
end $$;
revoke all on function public.research_withdraw(boolean) from public, anon;
grant execute on function public.research_withdraw(boolean) to authenticated;

-- ---------------------------------------------------------------------
-- For the research team (the "Research data" permission)
-- ---------------------------------------------------------------------

-- Counts only: no answers, no names.
create or replace function public.research_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_run_research() then raise exception 'Only the research team can see this' using errcode = '42501'; end if;
  return jsonb_build_object(
    'eligible', (select count(*) from public.profiles p where public.research_eligible(p.id)),
    'consented', (select count(*) from public.research_enrolments where decision = 'consented'),
    'declined', (select count(*) from public.research_enrolments where decision = 'declined'),
    'withdrawn', (select count(*) from public.research_enrolments where withdrawn_at is not null),
    'withdrawn_deleted', (select count(*) from public.research_enrolments where withdrawal = 'delete'),
    'pre', (select count(*) from public.research_responses where stage = 'pre'),
    'post', (select count(*) from public.research_responses where stage = 'post'),
    'followup', (select count(*) from public.research_responses where stage = 'followup'),
    'pre_post', (select count(*) from (select participant_code from public.research_responses where stage in ('pre', 'post') group by 1 having count(*) = 2) x),
    'all_three', (select count(*) from (select participant_code from public.research_responses group by 1 having count(*) = 3) x)
  );
end $$;
revoke all on function public.research_summary() from public, anon;
grant execute on function public.research_summary() to authenticated;

-- The de-identified dataset: study codes, consent flags, answers. Check-in
-- is linked only for people who agreed to it. Every export is logged.
create or replace function public.research_export()
returns table (
  participant_code text, consent_linkage boolean, consent_sharing boolean, withdrawn boolean, checked_in boolean,
  stage text, answers jsonb, instrument_version text, submitted_at timestamptz, started_at timestamptz
)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.can_run_research() then raise exception 'Only the research team can export the data' using errcode = '42501'; end if;
  insert into public.audit_events (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'export', 'research_responses', null, jsonb_build_object('rows', (select count(*) from public.research_responses)));
  return query
    select e.participant_code, e.consent_linkage, e.consent_sharing, e.withdrawn_at is not null,
           case when e.consent_linkage and e.user_id is not null then exists (
             select 1 from public.registrations g join public.editions ed on ed.id = g.edition_id and ed.is_current
              where g.user_id = e.user_id and g.checked_in_at is not null) end,
           r.stage, r.answers, r.instrument_version, r.submitted_at, r.started_at
      from public.research_enrolments e
      left join public.research_responses r on r.participant_code = e.participant_code
     where e.decision = 'consented' and coalesce(e.withdrawal, '') <> 'delete'
     order by e.participant_code, r.submitted_at;
end $$;
revoke all on function public.research_export() from public, anon;
grant execute on function public.research_export() to authenticated;

-- Who to remind about an open questionnaire: participants who agreed to
-- be contacted and haven't done it, not reminded in the last 2 days.
-- Returns email addresses only, for the server to send the reminder.
create or replace function public.research_reminder_list(p_stage text)
returns table (email text, full_name text)
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.can_run_research() then raise exception 'Only the research team can send reminders' using errcode = '42501'; end if;
  if p_stage not in ('pre', 'post', 'followup') then raise exception 'Unknown questionnaire' using errcode = '22023'; end if;
  return query
    with due as (
      select e.participant_code, e.user_id from public.research_enrolments e
       where e.decision = 'consented' and e.withdrawn_at is null and e.consent_contact and e.user_id is not null
         and not exists (select 1 from public.research_responses r where r.participant_code = e.participant_code and r.stage = p_stage)
         and (p_stage = 'pre' or exists (select 1 from public.research_responses r where r.participant_code = e.participant_code and r.stage = 'pre'))
         and coalesce((e.last_reminded ->> p_stage)::timestamptz, '-infinity') < now() - interval '2 days'
    ), marked as (
      update public.research_enrolments x set last_reminded = x.last_reminded || jsonb_build_object(p_stage, now())
        from due where x.participant_code = due.participant_code
      returning x.user_id
    )
    select p.email, p.full_name from marked m join public.profiles p on p.id = m.user_id where p.email is not null;
  insert into public.audit_events (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'remind', 'research_enrolments', p_stage, '{}'::jsonb);
end $$;
revoke all on function public.research_reminder_list(text) from public, anon;
grant execute on function public.research_reminder_list(text) to authenticated;

-- Invitations for people who haven't decided yet, while the first
-- questionnaire is open: everyone eligible with no decision.
create or replace function public.research_invite_list()
returns table (email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_run_research() then raise exception 'Only the research team can send invitations' using errcode = '42501'; end if;
  return query
    select p.email, p.full_name from public.profiles p
     where public.research_eligible(p.id) and p.email is not null
       and not exists (select 1 from public.research_enrolments e where e.user_id = p.id);
end $$;
revoke all on function public.research_invite_list() from public, anon;
grant execute on function public.research_invite_list() to authenticated;

-- Break the link between study codes and accounts for good, once data
-- collection has ended. Site owner only. Cannot be undone.
create or replace function public.research_anonymise()
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  s public.research_study;
begin
  if not public.is_site_owner() then raise exception 'Only the site owner can anonymise the data' using errcode = '42501'; end if;
  select * into s from public.research_study where id = 1;
  if s.followup_closes_at is null or now() < s.followup_closes_at then
    raise exception 'Anonymise only after the last questionnaire has closed' using errcode = 'P0001';
  end if;
  update public.research_enrolments set user_id = null where user_id is not null;
  update public.research_study set enabled = false, anonymised_at = now(), updated_by = auth.uid(), updated_at = now() where id = 1;
  insert into public.audit_events (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'anonymise', 'research_enrolments', null, '{}'::jsonb);
end $$;
revoke all on function public.research_anonymise() from public, anon;
grant execute on function public.research_anonymise() to authenticated;

-- Log every change to the settings (switching on and off included).
drop trigger if exists research_study_audit on public.research_study;
create trigger research_study_audit after update on public.research_study
  for each row execute function public.audit_row_change();
