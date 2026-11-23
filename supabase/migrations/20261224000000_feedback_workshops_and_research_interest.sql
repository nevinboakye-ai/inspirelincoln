-- =====================================================================
-- Feedback form, second version
--
--   * "Each part of the day" is now a score from 1 to 5. Answers already
--     given as great / OK / poor are kept and read as 5 / 3 / 1.
--   * People say which workshop(s) they went to, and score the workshop and
--     the doctor who led it, each from 1 to 5, with an optional comment.
--   * A last question: would they like to do their own research with
--     INSPIRE's support? The answer itself stays without a name like the
--     rest of the form. Anyone who also ticks "Get in touch with me" is
--     added to a separate list, with their name, that the committee can
--     see and contact. "Your own research" is added as a topic for
--     contacting the committee.
--
-- Run after 20261223000000_post_conference_feedback_and_gallery.sql.
-- Safe to run more than once.
-- =====================================================================

alter table public.conference_feedback
  add column if not exists workshops jsonb not null default '[]'::jsonb,
  add column if not exists research_interest text;

alter table public.conference_feedback drop constraint if exists conference_feedback_workshops_check;
alter table public.conference_feedback add constraint conference_feedback_workshops_check
  check (jsonb_typeof(workshops) = 'array' and jsonb_array_length(workshops) <= 6);
alter table public.conference_feedback drop constraint if exists conference_feedback_research_interest_check;
alter table public.conference_feedback add constraint conference_feedback_research_interest_check
  check (research_interest in ('yes', 'maybe', 'no'));

-- People who'd like help doing their own research and asked to be contacted.
-- Kept apart from the feedback so the feedback stays without names.
create table if not exists public.research_interest (
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  primary key (edition_id, user_id)
);
alter table public.research_interest enable row level security;
drop policy if exists "research interest: own read" on public.research_interest;
create policy "research interest: own read" on public.research_interest for select using (user_id = auth.uid());
revoke insert, update, delete on public.research_interest from anon, authenticated;

-- "Your own research" as a topic people can pick when they contact the committee.
alter table public.enquiry_threads drop constraint if exists enquiry_threads_topic_check;
alter table public.enquiry_threads add constraint enquiry_threads_topic_check
  check (topic in ('question', 'request', 'technical', 'access', 'presenting', 'research', 'other'));

-- The first version of the form's send function is replaced by the one below.
drop function if exists public.submit_conference_feedback(int, int, jsonb, text[], text, text[], text, text, boolean);

/**
 * Sends feedback for the current edition. Once only. Workshops are checked
 * against this edition's published workshops, and each score must be 1 to 5.
 */
create or replace function public.submit_conference_feedback(
  p_overall int, p_recommend int, p_parts jsonb, p_highlights text[], p_highlight_note text,
  p_improvements text[], p_improve_note text, p_comments text, p_quote_ok boolean,
  p_workshops jsonb, p_research text, p_research_contact boolean
) returns text language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  ed uuid := public.current_edition_id();
  ws jsonb := '[]'::jsonb;
  w jsonb;
  inserted int;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then return 'signed_out'; end if;
  if not (me.account_status = 'approved' or me.role = 'admin') then return 'not_approved'; end if;
  if ed is null then return 'no_edition'; end if;

  -- Scores for each part of the day: whole numbers from 1 to 5.
  if p_parts is not null and (jsonb_typeof(p_parts) <> 'object' or exists (
    select 1 from jsonb_each(p_parts) e
     where jsonb_typeof(e.value) <> 'number' or (e.value)::numeric not in (1, 2, 3, 4, 5)
  )) then return 'invalid'; end if;

  -- Workshops: only this edition's published ones, once each, scores 1 to 5 or blank.
  for w in select * from jsonb_array_elements(coalesce(p_workshops, '[]'::jsonb)) loop
    if not exists (select 1 from public.workshops x where x.id::text = w->>'id' and x.edition_id = ed and x.published) then continue; end if;
    if ws @> jsonb_build_array(jsonb_build_object('id', w->>'id')) then continue; end if;
    if coalesce(w->>'workshop', '1') !~ '^[1-5]$' or coalesce(w->>'lead', '1') !~ '^[1-5]$' then return 'invalid'; end if;
    ws := ws || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'id', w->>'id',
      'workshop', (w->>'workshop')::int,
      'lead', (w->>'lead')::int,
      'note', nullif(btrim(left(w->>'note', 1000)), '')
    )));
  end loop;
  if jsonb_array_length(ws) > 6 then return 'invalid'; end if;
  if p_research is not null and p_research not in ('yes', 'maybe', 'no') then return 'invalid'; end if;

  insert into public.conference_feedback (edition_id, user_id, roles, overall, recommend, parts, highlights, highlight_note,
                                          improvements, improve_note, comments, quote_ok, workshops, research_interest)
  values (ed, me.id, public.all_types(me.account_type, me.extra_types), p_overall, p_recommend, coalesce(p_parts, '{}'::jsonb),
          coalesce(p_highlights, '{}'), nullif(btrim(p_highlight_note), ''), coalesce(p_improvements, '{}'),
          nullif(btrim(p_improve_note), ''), nullif(btrim(p_comments), ''), coalesce(p_quote_ok, false), ws, p_research)
  on conflict (edition_id, user_id) do nothing;
  get diagnostics inserted = row_count;

  -- Only alongside a first answer, and only if they said yes or maybe.
  if inserted > 0 and coalesce(p_research_contact, false) and p_research in ('yes', 'maybe') then
    insert into public.research_interest (edition_id, user_id) values (ed, me.id) on conflict do nothing;
  end if;
  return 'ok';
end $$;
revoke all on function public.submit_conference_feedback(int, int, jsonb, text[], text, text[], text, text, boolean, jsonb, text, boolean) from public, anon;
grant execute on function public.submit_conference_feedback(int, int, jsonb, text[], text, text[], text, text, boolean, jsonb, text, boolean) to authenticated;

/** Whether the signed-in person asked the committee to help with their own research. */
create or replace function public.my_research_interest()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.research_interest r where r.user_id = auth.uid() and r.edition_id = public.current_edition_id())
$$;
grant execute on function public.my_research_interest() to authenticated;

/**
 * Every answer for the current edition, without names or account ids, in a
 * random order, for people with the Conference feedback permission. Also the
 * number of approved accounts, for the response rate, and the workshops
 * people could rate (with who led them).
 */
create or replace function public.conference_feedback_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_access('view_feedback') then jsonb_build_object(
    'accounts', (select count(*) from public.profiles p where p.account_status = 'approved'),
    'workshops', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'number', w.number, 'title', w.title, 'facilitator', w.facilitator) order by w.number)
        from public.workshops w where w.edition_id = public.current_edition_id() and w.published
    ), '[]'::jsonb),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'roles', f.roles, 'overall', f.overall, 'recommend', f.recommend, 'parts', f.parts,
        'highlights', f.highlights, 'highlight_note', f.highlight_note,
        'improvements', f.improvements, 'improve_note', f.improve_note,
        'comments', f.comments, 'quote_ok', f.quote_ok, 'day', f.created_at::date,
        'workshops', f.workshops, 'research', f.research_interest
      ) order by md5(f.user_id::text || f.edition_id::text))
      from public.conference_feedback f where f.edition_id = public.current_edition_id()
    ), '[]'::jsonb)
  ) end
$$;
revoke all on function public.conference_feedback_summary() from public, anon;
grant execute on function public.conference_feedback_summary() to authenticated;

/**
 * The people who'd like help with their own research and asked to be
 * contacted, newest first, for people with the Conference feedback
 * permission.
 */
create or replace function public.research_interest_list()
returns table (user_id uuid, full_name text, email text, institution text, year_of_study text, asked_at timestamptz, contacted_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.user_id, p.full_name, p.email, p.institution, p.year_of_study, r.created_at, r.contacted_at
    from public.research_interest r join public.profiles p on p.id = r.user_id
   where public.has_access('view_feedback') and r.edition_id = public.current_edition_id()
   order by r.created_at desc
$$;
revoke all on function public.research_interest_list() from public, anon;
grant execute on function public.research_interest_list() to authenticated;

/** Marks someone on the research list as contacted, or not. */
create or replace function public.research_interest_mark(p_user uuid, p_contacted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_access('view_feedback') then raise exception 'not authorised'; end if;
  update public.research_interest set contacted_at = case when p_contacted then now() end
   where user_id = p_user and edition_id = public.current_edition_id();
end $$;
revoke all on function public.research_interest_mark(uuid, boolean) from public, anon;
grant execute on function public.research_interest_mark(uuid, boolean) to authenticated;
