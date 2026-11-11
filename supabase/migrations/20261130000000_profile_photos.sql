-- =====================================================================
-- Profile photos.
--
--   * Everyone can add a photo of themselves to their profile. The site
--     crops it to a square and re-saves it in the browser (WebP, or JPEG
--     where the browser can't make WebP), which also
--     removes hidden details such as where it was taken.
--   * Photos live in a private "avatars" folder, never a public one. Each
--     person can only add or remove files in their own folder. Only signed
--     in, confirmed delegates and the committee can open a photo, and only
--     through a short-lived link the website makes when it shows someone's
--     card, the delegate network or People I've met.
--   * The photo shows wherever the person's card shows: their Delegate
--     Card, their scanned card, People I've met and the delegate network.
-- =====================================================================

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles drop constraint if exists profiles_avatar_path_check;
alter table public.profiles add constraint profiles_avatar_path_check
  check (avatar_path is null or (avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$' and split_part(avatar_path, '/', 1) = id::text));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1024 * 1024, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: members read" on storage.objects;
create policy "avatars: members read" on storage.objects for select using (
  bucket_id = 'avatars' and auth.uid() is not null and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_committee()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.account_status = 'approved' or p.role = 'admin'))
  )
);
drop policy if exists "avatars: owner upload" on storage.objects;
create policy "avatars: owner upload" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "avatars: owner or exec delete" on storage.objects;
create policy "avatars: owner or exec delete" on storage.objects for delete using (
  bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_exec())
);

-- The photo travels with the card, so it's only seen where the card is.
create or replace function public.card_json(t public.profiles)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', t.id,
    'full_name', t.full_name,
    'institution', t.institution,
    'year_of_study', t.year_of_study,
    'roles', to_jsonb(public.all_types(t.account_type, t.extra_types)),
    'committee_position', case when exists (
        select 1 from unnest(public.all_types(t.account_type, t.extra_types)) r
         where r not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
      ) then t.committee_position end,
    'bio', t.bio,
    'linkedin_url', t.linkedin_url,
    'email', case when t.network_show_email then t.email end,
    'presentation_title', case when public.all_types(t.account_type, t.extra_types) && array['oral_presenter', 'poster_presenter']::public.account_type[]
      then t.presentation_title end,
    'avatar_path', t.avatar_path
  )
$$;

-- The delegate network gains the photo too (the return type changes, so
-- the function is replaced rather than altered).
drop function if exists public.network_directory();
create function public.network_directory()
returns table (id text, full_name text, institution text, year_of_study text, account_type public.account_type,
               committee_position text, bio text, linkedin_url text, email text, joined boolean, avatar_path text)
language sql stable security definer set search_path = public as $$
  with me as (
    select (p.account_status = 'approved' or p.role = 'admin') as member,
           public.has_access('review_accounts') as staff
      from public.profiles p
     where p.id = auth.uid() and (public.network_is_open() or public.is_site_owner())
  ), people as (
    select p.id::text, p.full_name, p.institution, p.year_of_study, p.account_type,
           case when p.account_type not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist') then p.committee_position end,
           p.bio, p.linkedin_url,
           case when p.network_show_email then p.email end,
           true,
           p.avatar_path
      from public.profiles p, me
     where (me.member or me.staff)
       and p.network_listed and p.account_status = 'approved' and p.full_name is not null
    union all
    select 'selected:' || md5(r.email), r.full_name, r.institution, r.year_of_study, r.account_type,
           null, null, null, null, false, null
      from public.delegate_roster r, me
     where me.staff
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
  )
  select * from people order by lower(full_name)
$$;
revoke all on function public.network_directory() from public, anon;
grant execute on function public.network_directory() to authenticated;
