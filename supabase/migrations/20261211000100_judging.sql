-- =====================================================================
-- Judging on the day, and speaker accounts. Part 2 of 2.
--
--   * Judges mark oral and poster presentations from the judging portal
--     (/judge) on their phones: a mark out of the criteria below, what went
--     well, what to improve, and an optional note for the committee only.
--   * Marks and feedback go to the committee only. Presenters see their
--     feedback once the committee releases it (usually after prizes are
--     announced), with or without the marks and judge names.
--   * Two new permissions, so the site owner can give or take them away
--     per account type or per person on the Platform dashboard:
--       judge_presentations  judges, by default
--       manage_judging       executive committee, vice president, president
--   * Speakers can be linked to their speaker profile, see their sessions
--     in My Hub and keep their own biography up to date.
--   * Safe to run more than once.
-- =====================================================================

-- Permissions ---------------------------------------------------------------
insert into public.access_capabilities (key, label, description, sort) values
  ('judge_presentations', 'Judge presentations', 'Use the judging portal on the day: open presenters'' slides and posters, mark them and write feedback.', 58),
  ('manage_judging', 'Judging results', 'Set the marking criteria, choose who each judge marks, see every mark and comment, and release feedback to presenters.', 59)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, c.key,
       (c.key = 'judge_presentations' and t.account_type = 'judge')
       or (c.key = 'manage_judging' and t.account_type in ('executive_committee', 'vice_president', 'president'))
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
 cross join public.access_capabilities c
on conflict do nothing;

-- Judges and speakers never get a committee permission by accident: the new
-- types start with every other permission switched off (rows above).

-- Settings --------------------------------------------------------------------
create table if not exists public.judging_settings (
  edition_id uuid primary key references public.editions (id) on delete cascade,
  -- Judges can add and change marks while judging is open.
  open boolean not null default true,
  -- Presenters can see their feedback.
  released boolean not null default false,
  -- With released feedback, also show the marks and who wrote it.
  release_scores boolean not null default true,
  release_names boolean not null default false,
  released_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.judging_settings (edition_id)
select id from public.editions where is_current
on conflict do nothing;

-- What judges mark against, separately for talks and posters.
create table if not exists public.judging_criteria (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  kind text not null check (kind in ('oral', 'poster')),
  label text not null check (char_length(label) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  max_score int not null default 10 check (max_score between 1 and 100),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists judging_criteria_edition on public.judging_criteria (edition_id, kind, sort);

-- Starting criteria, each out of 10. The committee can change them on
-- Committee dashboard > Judging > Set up.
insert into public.judging_criteria (edition_id, kind, label, description, sort)
select e.id, c.kind, c.label, c.description, c.sort
  from (select id from public.editions where is_current) e
 cross join (values
   ('oral', 'Background and aim', 'A clear research question, why it matters and how it fits what is already known.', 1),
   ('oral', 'Methods', 'A suitable design, clearly explained, with sound analysis.', 2),
   ('oral', 'Results and conclusions', 'Results shown clearly, conclusions the data support, and limitations acknowledged.', 3),
   ('oral', 'Delivery and slides', 'A clear, well-paced talk within time, with slides that are easy to read.', 4),
   ('oral', 'Questions and discussion', 'Understanding shown when answering the judges'' and audience''s questions.', 5),
   ('poster', 'Background and aim', 'A clear research question, why it matters and how it fits what is already known.', 1),
   ('poster', 'Methods', 'A suitable design, clearly explained, with sound analysis.', 2),
   ('poster', 'Results and conclusions', 'Results shown clearly, conclusions the data support, and limitations acknowledged.', 3),
   ('poster', 'Poster design', 'Layout, readability, figures and a logical flow a reader can follow alone.', 4),
   ('poster', 'Explanation and questions', 'A clear summary to the judges and confident answers to their questions.', 5)
 ) as c(kind, label, description, sort)
 where not exists (select 1 from public.judging_criteria x where x.edition_id = e.id);

-- Which kinds each judge marks. No row means both.
create table if not exists public.judging_panel (
  judge_id uuid primary key references public.profiles (id) on delete cascade,
  kinds text[] not null default array['oral', 'poster'],
  updated_at timestamptz not null default now(),
  check (cardinality(kinds) between 1 and 2 and kinds <@ array['oral', 'poster'])
);

-- Optional: the presenters a judge has been asked to mark. Judges with no
-- assignments see everyone of the kinds they judge.
create table if not exists public.judging_assignments (
  judge_id uuid not null references public.profiles (id) on delete cascade,
  presenter_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('oral', 'poster')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (judge_id, presenter_id, kind)
);
create index if not exists judging_assignments_presenter on public.judging_assignments (presenter_id, kind);

-- Where to find each presentation on the day, for example "Board 12" or
-- "Session 2, 11:05, LMS0008", and the order judges see them in.
create table if not exists public.judging_entries (
  presenter_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('oral', 'poster')),
  label text not null default '' check (char_length(label) <= 80),
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (presenter_id, kind)
);

-- One mark per judge, presenter and kind.
create table if not exists public.judging_marks (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete cascade,
  -- Kept if the judge's account is later removed, so results don't change.
  judge_id uuid references public.profiles (id) on delete set null,
  judge_name text not null default '' check (char_length(judge_name) <= 160),
  presenter_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('oral', 'poster')),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  total int not null default 0,
  max_total int not null default 0,
  strengths text not null default '' check (char_length(strengths) <= 3000),
  improvements text not null default '' check (char_length(improvements) <= 3000),
  committee_note text not null default '' check (char_length(committee_note) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_id, judge_id, presenter_id, kind)
);
create index if not exists judging_marks_presenter on public.judging_marks (edition_id, presenter_id, kind);
drop trigger if exists judging_marks_touch on public.judging_marks;
create trigger judging_marks_touch before update on public.judging_marks for each row execute function public.touch_updated_at();
drop trigger if exists judging_marks_audit on public.judging_marks;
create trigger judging_marks_audit after insert or update or delete on public.judging_marks for each row execute function public.audit_row_change();
drop trigger if exists judging_settings_audit on public.judging_settings;
create trigger judging_settings_audit after insert or update or delete on public.judging_settings for each row execute function public.audit_row_change();

-- Helpers ---------------------------------------------------------------------
create or replace function public.current_edition_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.editions where is_current limit 1
$$;

-- Whether someone presents this kind: talks for oral presenters; posters
-- for poster presenters and the oral waiting list.
create or replace function public.presents_kind(p public.profiles, k text)
returns boolean language sql stable as $$
  select p.account_status = 'approved' and case k
    when 'oral' then 'oral_presenter' = any(public.all_types(p.account_type, p.extra_types))
    when 'poster' then public.all_types(p.account_type, p.extra_types) && array['poster_presenter', 'oral_waitlist']::public.account_type[]
    else false end
$$;

create or replace function public.can_judge()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('judge_presentations')
$$;

create or replace function public.can_manage_judging()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('manage_judging')
$$;

-- Row level security ----------------------------------------------------------
alter table public.judging_settings enable row level security;
alter table public.judging_criteria enable row level security;
alter table public.judging_panel enable row level security;
alter table public.judging_assignments enable row level security;
alter table public.judging_entries enable row level security;
alter table public.judging_marks enable row level security;

drop policy if exists "judging settings: read" on public.judging_settings;
drop policy if exists "judging settings: managers write" on public.judging_settings;
create policy "judging settings: read" on public.judging_settings for select using (public.can_judge() or public.can_manage_judging());
create policy "judging settings: managers write" on public.judging_settings for all using (public.can_manage_judging()) with check (public.can_manage_judging());

drop policy if exists "judging criteria: read" on public.judging_criteria;
drop policy if exists "judging criteria: managers write" on public.judging_criteria;
create policy "judging criteria: read" on public.judging_criteria for select using (public.can_judge() or public.can_manage_judging());
create policy "judging criteria: managers write" on public.judging_criteria for all using (public.can_manage_judging()) with check (public.can_manage_judging());

drop policy if exists "judging panel: read" on public.judging_panel;
drop policy if exists "judging panel: managers write" on public.judging_panel;
create policy "judging panel: read" on public.judging_panel for select using (judge_id = auth.uid() or public.can_manage_judging());
create policy "judging panel: managers write" on public.judging_panel for all using (public.can_manage_judging()) with check (public.can_manage_judging());

drop policy if exists "judging assignments: read" on public.judging_assignments;
drop policy if exists "judging assignments: managers write" on public.judging_assignments;
create policy "judging assignments: read" on public.judging_assignments for select using (judge_id = auth.uid() or public.can_manage_judging());
create policy "judging assignments: managers write" on public.judging_assignments for all using (public.can_manage_judging()) with check (public.can_manage_judging());

drop policy if exists "judging entries: read" on public.judging_entries;
drop policy if exists "judging entries: managers write" on public.judging_entries;
create policy "judging entries: read" on public.judging_entries for select using (public.can_judge() or public.can_manage_judging());
create policy "judging entries: managers write" on public.judging_entries for all using (public.can_manage_judging()) with check (public.can_manage_judging());

-- Marks: a judge reads their own; the committee with manage_judging reads
-- all and can remove one. Presenters never read this table: they get their
-- released feedback from my_judging_feedback(). Saving goes through
-- save_judging_mark(), which checks everything.
drop policy if exists "judging marks: own or managers read" on public.judging_marks;
drop policy if exists "judging marks: managers delete" on public.judging_marks;
create policy "judging marks: own or managers read" on public.judging_marks for select using (judge_id = auth.uid() or public.can_manage_judging());
create policy "judging marks: managers delete" on public.judging_marks for delete using (public.can_manage_judging());

grant select, insert, update, delete on public.judging_settings, public.judging_criteria, public.judging_panel, public.judging_assignments, public.judging_entries to authenticated;
grant select, delete on public.judging_marks to authenticated;

-- Judges open presenters' slides and posters.
drop policy if exists "submissions files: judges read" on storage.objects;
create policy "submissions files: judges read" on storage.objects for select using (
  bucket_id = 'submissions' and (public.can_judge() or public.can_manage_judging())
);

-- The list judges work through ------------------------------------------------
-- One row per presenter and kind, with their latest upload, where to find
-- them, whether the caller has been asked to mark them and how far the
-- caller has got. marks_in counts submitted marks from every judge.
drop function if exists public.judging_board();
create function public.judging_board()
returns table (
  presenter_id uuid, kind text, full_name text, institution text, title text, avatar_path text,
  label text, sort int, attendance text, checked_in boolean,
  submission_id uuid, file_path text, file_name text, file_type text, uploaded_at timestamptz,
  assigned boolean, my_status text, my_total int, my_max int, marks_in int
)
language plpgsql stable security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
begin
  if auth.uid() is null or not (public.can_judge() or public.can_manage_judging()) then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
  select p.id, k.kind, p.full_name, p.institution,
         coalesce(nullif(s.title, ''), nullif(p.presentation_title, '')),
         p.avatar_path,
         nullif(e.label, ''), coalesce(e.sort, 0), pa.response,
         (r.checked_in_at is not null),
         s.id, s.file_path, s.file_name, s.file_type, s.created_at,
         exists (select 1 from public.judging_assignments a where a.judge_id = auth.uid() and a.presenter_id = p.id and a.kind = k.kind),
         m.status, m.total, m.max_total,
         (select count(*)::int from public.judging_marks x where x.edition_id = ed and x.presenter_id = p.id and x.kind = k.kind and x.status = 'submitted')
    from public.profiles p
   cross join (values ('oral'), ('poster')) as k(kind)
    left join lateral (
      select ps.id, ps.title, ps.file_path, ps.file_name, ps.file_type, ps.created_at
        from public.presentation_submissions ps
       where ps.user_id = p.id and ps.edition_id = ed
         and ps.kind = (case k.kind when 'oral' then 'slides' else 'poster' end)::public.submission_kind
       order by ps.version desc limit 1
    ) s on true
    left join public.judging_entries e on e.presenter_id = p.id and e.kind = k.kind
    left join public.presenter_attendance pa on pa.user_id = p.id
    left join public.registrations r on r.user_id = p.id and r.edition_id = ed
    left join public.judging_marks m on m.edition_id = ed and m.judge_id = auth.uid() and m.presenter_id = p.id and m.kind = k.kind
   where public.presents_kind(p, k.kind)
   order by k.kind, coalesce(e.sort, 0) = 0, e.sort, lower(p.full_name);
end $$;
revoke all on function public.judging_board() from public, anon;
grant execute on function public.judging_board() to authenticated;

-- Scanning a presenter's Delegate Card in the judging portal.
create or replace function public.judging_lookup(code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t public.profiles;
  kinds text[];
begin
  if auth.uid() is null or not (public.can_judge() or public.can_manage_judging()) then
    return jsonb_build_object('state', 'not_allowed');
  end if;
  select * into t from public.profiles where card_code = public.clean_card_code(code);
  if t.id is null then
    return jsonb_build_object('state', 'unknown');
  end if;
  kinds := array_remove(array[
    case when public.presents_kind(t, 'oral') then 'oral' end,
    case when public.presents_kind(t, 'poster') then 'poster' end
  ], null);
  if cardinality(kinds) = 0 then
    return jsonb_build_object('state', 'not_presenter', 'full_name', t.full_name);
  end if;
  return jsonb_build_object('state', 'ok', 'presenter_id', t.id, 'full_name', t.full_name, 'kinds', to_jsonb(kinds));
end $$;
revoke all on function public.judging_lookup(text) from public, anon;
grant execute on function public.judging_lookup(text) to authenticated;

-- Saving a mark ---------------------------------------------------------------
-- Drafts can be partly filled in. Submitting needs every criterion scored
-- and both pieces of feedback written. A submitted mark can be changed (and
-- stays submitted) while judging is open.
create or replace function public.save_judging_mark(
  p_presenter uuid, p_kind text, p_scores jsonb, p_strengths text, p_improvements text, p_note text, p_submit boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  t public.profiles;
  ed uuid := public.current_edition_id();
  is_open boolean;
  existing public.judging_marks;
  c record;
  raw jsonb;
  n int;
  clean jsonb := '{}'::jsonb;
  tot int := 0;
  mx int := 0;
  missing int := 0;
  st text;
begin
  if auth.uid() is null or not public.can_judge() then raise exception 'NOT_ALLOWED'; end if;
  if ed is null then raise exception 'NO_EVENT'; end if;
  select coalesce((select open from public.judging_settings where edition_id = ed), true) into is_open;
  if not is_open then raise exception 'JUDGING_CLOSED'; end if;
  if p_kind not in ('oral', 'poster') then raise exception 'BAD_KIND'; end if;
  if p_presenter = auth.uid() then raise exception 'OWN_PRESENTATION'; end if;
  select * into me from public.profiles where id = auth.uid();
  select * into t from public.profiles where id = p_presenter;
  if t.id is null or not public.presents_kind(t, p_kind) then raise exception 'NOT_PRESENTER'; end if;
  if jsonb_typeof(coalesce(p_scores, '{}'::jsonb)) <> 'object' then raise exception 'BAD_SCORE'; end if;

  for c in select id, max_score from public.judging_criteria where edition_id = ed and kind = p_kind order by sort loop
    mx := mx + c.max_score;
    raw := p_scores -> c.id::text;
    if raw is null or raw = 'null'::jsonb then
      missing := missing + 1;
      continue;
    end if;
    if jsonb_typeof(raw) <> 'number' then raise exception 'BAD_SCORE'; end if;
    n := (raw #>> '{}')::numeric;
    if n::numeric <> (raw #>> '{}')::numeric or n < 0 or n > c.max_score then raise exception 'BAD_SCORE'; end if;
    clean := clean || jsonb_build_object(c.id::text, n);
    tot := tot + n;
  end loop;
  if mx = 0 then raise exception 'NO_CRITERIA'; end if;

  select * into existing from public.judging_marks
   where edition_id = ed and judge_id = auth.uid() and presenter_id = p_presenter and kind = p_kind;
  st := case when p_submit or existing.status = 'submitted' then 'submitted' else 'draft' end;
  if st = 'submitted' then
    if missing > 0 then raise exception 'INCOMPLETE_SCORES'; end if;
    if char_length(trim(coalesce(p_strengths, ''))) = 0 or char_length(trim(coalesce(p_improvements, ''))) = 0 then
      raise exception 'INCOMPLETE_FEEDBACK';
    end if;
  end if;

  insert into public.judging_marks (edition_id, judge_id, judge_name, presenter_id, kind, scores, total, max_total,
                                    strengths, improvements, committee_note, status, submitted_at)
  values (ed, auth.uid(), left(coalesce(nullif(trim(me.full_name), ''), me.email, 'Judge'), 160), p_presenter, p_kind, clean, tot, mx,
          left(trim(coalesce(p_strengths, '')), 3000), left(trim(coalesce(p_improvements, '')), 3000),
          left(trim(coalesce(p_note, '')), 2000), st, case when st = 'submitted' then now() end)
  on conflict (edition_id, judge_id, presenter_id, kind) do update set
    judge_name = excluded.judge_name,
    scores = excluded.scores, total = excluded.total, max_total = excluded.max_total,
    strengths = excluded.strengths, improvements = excluded.improvements, committee_note = excluded.committee_note,
    status = excluded.status,
    submitted_at = coalesce(public.judging_marks.submitted_at, excluded.submitted_at);
  return jsonb_build_object('status', st, 'total', tot, 'max_total', mx, 'missing', missing);
end $$;
revoke all on function public.save_judging_mark(uuid, text, jsonb, text, text, text, boolean) from public, anon;
grant execute on function public.save_judging_mark(uuid, text, jsonb, text, text, text, boolean) to authenticated;

-- A presenter's own feedback, only once the committee has released it.
create or replace function public.my_judging_feedback()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  s public.judging_settings;
begin
  if auth.uid() is null then return jsonb_build_object('released', false); end if;
  select * into s from public.judging_settings where edition_id = ed;
  if s.edition_id is null or not s.released then
    return jsonb_build_object('released', false);
  end if;
  return jsonb_build_object(
    'released', true,
    'released_at', s.released_at,
    'show_scores', s.release_scores,
    'show_names', s.release_names,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', m.kind,
        'judge', case when s.release_names then m.judge_name end,
        'total', case when s.release_scores then m.total end,
        'max_total', case when s.release_scores then m.max_total end,
        'scores', case when s.release_scores then (
          select coalesce(jsonb_agg(jsonb_build_object('label', c.label, 'score', (m.scores ->> c.id::text)::int, 'max', c.max_score) order by c.sort), '[]'::jsonb)
            from public.judging_criteria c where c.edition_id = ed and c.kind = m.kind and m.scores ? c.id::text
        ) end,
        'strengths', m.strengths,
        'improvements', m.improvements,
        'submitted_at', m.submitted_at
      ) order by m.kind, m.submitted_at)
        from public.judging_marks m
       where m.edition_id = ed and m.presenter_id = auth.uid() and m.status = 'submitted'
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.my_judging_feedback() from public, anon;
grant execute on function public.my_judging_feedback() to authenticated;

-- Approved judges and anyone else allowed to judge, for the committee.
create or replace function public.judging_judges()
returns table (id uuid, full_name text, email text, institution text, committee_position text, kinds text[], last_seen_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_judging() then raise exception 'NOT_ALLOWED'; end if;
  return query
  select p.id, p.full_name, p.email, p.institution, p.committee_position,
         coalesce(j.kinds, array['oral', 'poster']), ua.last_seen_at
    from public.profiles p
    left join public.judging_panel j on j.judge_id = p.id
    left join public.user_activity ua on ua.user_id = p.id
   where p.role = 'admin' is not true
     and (
       (p.account_status = 'approved' and exists (
          select 1 from public.access_rules r
           where r.account_type = any(public.all_types(p.account_type, p.extra_types))
             and r.capability = 'judge_presentations' and r.allowed)
        and not exists (select 1 from public.access_overrides o where o.user_id = p.id and o.capability = 'judge_presentations' and not o.allowed))
       or exists (select 1 from public.access_overrides o where o.user_id = p.id and o.capability = 'judge_presentations' and o.allowed and p.account_status <> 'declined')
     )
   order by lower(p.full_name);
end $$;
revoke all on function public.judging_judges() from public, anon;
grant execute on function public.judging_judges() to authenticated;

-- Speakers ----------------------------------------------------------------------
alter table public.speakers add column if not exists profile_id uuid references public.profiles (id) on delete set null;
create unique index if not exists speakers_profile_key on public.speakers (profile_id) where profile_id is not null;

drop policy if exists "speakers: linked read" on public.speakers;
create policy "speakers: linked read" on public.speakers for select using (profile_id = auth.uid());

-- A linked speaker keeps their own biography and title up to date.
create or replace function public.update_my_speaker(p_position text, p_institution text, p_credentials text, p_bio text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_ALLOWED'; end if;
  if char_length(coalesce(p_bio, '')) > 2000 or char_length(coalesce(p_position, '')) > 160
     or char_length(coalesce(p_institution, '')) > 160 or char_length(coalesce(p_credentials, '')) > 80 then
    raise exception 'TOO_LONG';
  end if;
  update public.speakers
     set position = nullif(trim(p_position), ''),
         institution = nullif(trim(p_institution), ''),
         credentials = nullif(trim(p_credentials), ''),
         bio = nullif(trim(p_bio), '')
   where profile_id = auth.uid()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'approved');
  return found;
end $$;
revoke all on function public.update_my_speaker(text, text, text, text) from public, anon;
grant execute on function public.update_my_speaker(text, text, text, text) to authenticated;

-- Speaker accounts the committee can link to a speaker profile.
create or replace function public.speaker_accounts()
returns table (id uuid, full_name text, email text, institution text, speaker_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.can_manage_judging() or public.has_access('edit_website')) then raise exception 'NOT_ALLOWED'; end if;
  return query
  select p.id, p.full_name, p.email, p.institution, s.id
    from public.profiles p
    left join public.speakers s on s.profile_id = p.id
   where 'speaker' = any(public.all_types(p.account_type, p.extra_types)) and p.account_status <> 'declined'
   order by lower(p.full_name);
end $$;
revoke all on function public.speaker_accounts() from public, anon;
grant execute on function public.speaker_accounts() to authenticated;
