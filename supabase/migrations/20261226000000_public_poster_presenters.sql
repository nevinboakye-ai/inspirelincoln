-- =====================================================================
-- Poster presenters on the public Presenters page.
--
--   * The Presenters page now lists poster presenters as well as oral
--     presenters, each in their own group, with their photo, bio,
--     university, year and poster title.
--   * A poster presenter is shown when their account is approved and they
--     present a poster (the poster presenter role, which everyone on the
--     oral waiting list also has), they're not on the "presentation not
--     accepted" list, and they haven't told us they couldn't attend to
--     present. Oral presenters are chosen exactly as before.
--   * The same choices apply to both: anyone can hide themselves in My Hub
--     > Delegate network (public_oral_listed now covers posters too), and
--     the site owner's "Presenters on the website" switch
--     (oral_presenters_public) hides the whole page.
--   * Needs 20261225000000_public_oral_presenters.sql first. Safe to run
--     more than once.
-- =====================================================================

comment on column public.profiles.public_oral_listed is
  'Shown on the public Presenters page (oral and poster presenters). They can untick this in My Hub.';

-- Everyone shown on the Presenters page, one row per kind of presentation.
drop function if exists public.public_student_presenters();
create function public.public_student_presenters()
returns table (
  id uuid,
  kind text,
  full_name text,
  institution text,
  year_of_study text,
  presentation_title text,
  bio text,
  avatar_path text,
  room_name text,
  talk int
)
language sql stable security definer set search_path = public as $$
  with shown as (
    select p.*
      from public.profiles p
     where coalesce((select enabled from public.site_switches where key = 'oral_presenters_public'), false)
       and p.account_status = 'approved'
       and p.network_listed
       and p.public_oral_listed
       and nullif(btrim(p.full_name), '') is not null
       and not exists (select 1 from public.abstract_not_accepted n where n.email = lower(p.email))
  )
  -- Oral presenters: placed in an oral presentation room, in running order.
  select * from (
    select p.id, 'oral'::text, btrim(p.full_name), p.institution, p.year_of_study,
           coalesce(nullif(btrim(p.presentation_title), ''),
                    (select s2.title from public.presentation_submissions s2
                      where s2.user_id = p.id and s2.kind = 'slides' order by s2.version desc limit 1)),
           nullif(btrim(p.bio), ''), p.avatar_path,
           regexp_replace(rm.name, '\s*\([^)]*\)', '', 'g'), o.position
      from public.oral_allocations o
      join shown p on lower(p.email) = o.email
      join public.sessions s on s.id = o.session_id
      left join public.rooms rm on rm.id = s.room_id
     where o.edition_id = public.current_edition_id()
       and o.session_id is not null
       and p.account_type <> 'oral_waitlist'
       and 'oral_presenter' = any(public.all_types(p.account_type, p.extra_types))
     order by s.starts_at nulls last, s.sort, o.position
  ) orals
  union all
  -- Poster presenters, by name.
  select * from (
    select p.id, 'poster'::text, btrim(p.full_name), p.institution, p.year_of_study,
           coalesce((select nullif(btrim(s2.title), '') from public.presentation_submissions s2
                      where s2.user_id = p.id and s2.kind = 'poster' order by s2.version desc limit 1),
                    case when not ('oral_presenter' = any(public.all_types(p.account_type, p.extra_types)))
                         then nullif(btrim(p.presentation_title), '') end),
           nullif(btrim(p.bio), ''), p.avatar_path, null::text, null::int
      from shown p
     where public.all_types(p.account_type, p.extra_types) && array['poster_presenter', 'oral_waitlist']::public.account_type[]
       and not exists (select 1 from public.presenter_attendance a where a.user_id = p.id and a.response = 'unavailable')
     order by lower(btrim(p.full_name))
  ) posters
$$;
revoke all on function public.public_student_presenters() from public;
grant execute on function public.public_student_presenters() to anon, authenticated;

-- Visitors may open the photos of everyone on the page, and no others.
create or replace function public.is_public_oral_avatar(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.public_student_presenters() x where x.avatar_path = p_path)
$$;
