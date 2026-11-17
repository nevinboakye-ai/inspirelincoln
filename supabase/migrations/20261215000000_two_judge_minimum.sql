-- At least two judges per presenter, and closing marking per presenter.
--
--   * A presenter's marking is complete once at least two judges have
--     submitted marks and feedback. More judges can still mark them after
--     that. The website shows "1 of 2 judges" until then, and only ranks
--     presenters with complete marking for results and prizes.
--   * Released feedback only reaches a presenter once their marking is
--     complete, so nobody gets feedback from a single judge.
--   * The committee can close marking for one presenter (judging_entries.
--     marking_closed). Judges can then read their marks for that presenter
--     but can't add or change any. Closing judging for everyone is the
--     existing "Judging open" setting.
--   * Needs 20261211000100_judging.sql first. Safe to run more than once.

alter table public.judging_entries add column if not exists marking_closed boolean not null default false;
alter table public.judging_entries add column if not exists closed_at timestamptz;

-- The list judges work through, now with whether marking is closed for each presenter.
drop function if exists public.judging_board();
create function public.judging_board()
returns table (
  presenter_id uuid, kind text, full_name text, institution text, title text, avatar_path text,
  label text, sort int, attendance text, checked_in boolean,
  submission_id uuid, file_path text, file_name text, file_type text, uploaded_at timestamptz,
  assigned boolean, my_status text, my_total int, my_max int, marks_in int, marking_closed boolean
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
         (select count(*)::int from public.judging_marks x where x.edition_id = ed and x.presenter_id = p.id and x.kind = k.kind and x.status = 'submitted'),
         coalesce(e.marking_closed, false)
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

-- Saving a mark: as before, and refused once marking is closed for the presenter.
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
  if exists (select 1 from public.judging_entries where presenter_id = p_presenter and kind = p_kind and marking_closed) then
    raise exception 'MARKING_CLOSED';
  end if;
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

-- A presenter's own feedback, once released, and only for presentations at
-- least two judges have submitted marks for.
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
         and (select count(*) from public.judging_marks x
               where x.edition_id = ed and x.presenter_id = m.presenter_id and x.kind = m.kind and x.status = 'submitted') >= 2
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.my_judging_feedback() from public, anon;
grant execute on function public.my_judging_feedback() to authenticated;

notify pgrst, 'reload schema';
