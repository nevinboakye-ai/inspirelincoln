-- =====================================================================
-- Oral presenters on the public website.
--
--   * The Speakers page gains its own "Oral presenters" section, apart
--     from the invited speakers, showing the delegates who presented
--     their research in the oral presentation sessions: their photo, bio,
--     university, year and talk title.
--   * Only accepted oral presenters are shown: an approved account with
--     the oral presenter role, placed in an oral presentation room on
--     Committee dashboard > Oral presentation rooms, and not on the
--     "presentation not accepted" list. The oral waiting list, declined
--     accounts and anyone who hid themselves from the delegate network
--     are never shown.
--   * Each presenter can hide themselves from the public page in My Hub >
--     Delegate network (public_oral_listed). The site owner can hide the
--     whole section with the "Oral presenters on the website" switch.
--   * Profile photos stay in the private "avatars" folder. Visitors can
--     only open the photo of someone currently shown on the page, and
--     only through a short-lived link.
--   * Needs 20261220000000_oral_presentation_rooms.sql first. Safe to run
--     more than once.
-- =====================================================================

alter table public.profiles add column if not exists public_oral_listed boolean not null default true;

insert into public.site_switches (key, enabled) values ('oral_presenters_public', true) on conflict do nothing;

-- The accepted oral presenters shown on the website. Everything else about
-- them (email, account details) stays private.
create or replace function public.public_oral_presenters()
returns table (
  id uuid,
  full_name text,
  institution text,
  year_of_study text,
  presentation_title text,
  bio text,
  avatar_path text,
  session_title text,
  room_name text,
  talk int
)
language sql stable security definer set search_path = public as $$
  select p.id,
         btrim(p.full_name),
         p.institution,
         p.year_of_study,
         coalesce(nullif(btrim(p.presentation_title), ''),
                  (select s2.title from public.presentation_submissions s2
                    where s2.user_id = p.id and s2.kind = 'slides' order by s2.version desc limit 1)),
         nullif(btrim(p.bio), ''),
         p.avatar_path,
         s.title,
         regexp_replace(rm.name, '\s*\([^)]*\)', '', 'g'),
         o.position
    from public.oral_allocations o
    join public.profiles p on lower(p.email) = o.email
    join public.sessions s on s.id = o.session_id
    left join public.rooms rm on rm.id = s.room_id
   where coalesce((select enabled from public.site_switches where key = 'oral_presenters_public'), false)
     and o.edition_id = public.current_edition_id()
     and o.session_id is not null
     and p.account_status = 'approved'
     and p.account_type <> 'oral_waitlist'
     and 'oral_presenter' = any(public.all_types(p.account_type, p.extra_types))
     and not exists (select 1 from public.abstract_not_accepted n where n.email = lower(p.email))
     and p.network_listed
     and p.public_oral_listed
     and nullif(btrim(p.full_name), '') is not null
   order by s.starts_at nulls last, s.sort, o.position
$$;
revoke all on function public.public_oral_presenters() from public;
grant execute on function public.public_oral_presenters() to anon, authenticated;

-- Whether a photo belongs to someone shown on the public page.
create or replace function public.is_public_oral_avatar(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.public_oral_presenters() x where x.avatar_path = p_path)
$$;
revoke all on function public.is_public_oral_avatar(text) from public;
grant execute on function public.is_public_oral_avatar(text) to anon, authenticated;

-- Visitors may make a short-lived link to those photos, and no others.
drop policy if exists "avatars: public oral presenters" on storage.objects;
create policy "avatars: public oral presenters" on storage.objects for select using (
  bucket_id = 'avatars' and public.is_public_oral_avatar(name)
);
