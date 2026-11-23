-- =====================================================================
-- Post-conference feedback, the post-conference hub and the photo gallery.
--
--   * A new site switch, "Post-conference hub" (post_conference), starts
--     ON because the conference has happened. While it's on, everyone with
--     an approved account is asked for short feedback the next time they
--     open My Hub. Giving it unlocks the post-conference hub: the gallery,
--     certificates, the post-conference booklet and presenter feedback.
--   * Feedback is one row per person per edition and can't be changed once
--     sent. The committee only ever reads it without names, through
--     conference_feedback_summary(), with the new "Conference feedback"
--     permission (view_feedback, executive committee and above to start).
--   * The gallery: anyone with an approved account who has given feedback
--     can add photos. Each photo waits for the committee unless it was
--     added by someone who moderates the gallery. Only accepted photos are
--     shown. Anyone who can see a photo can ask for it to be taken down,
--     which hides it again until the committee looks at it.
--   * A new permission, "Photo gallery" (moderate_gallery), starts with the
--     supporting committee and above.
--   * Photos live in a private "gallery" folder. The browser re-saves each
--     photo before upload, which removes hidden details such as where it
--     was taken.
--
-- Safe to run more than once.
-- =====================================================================

insert into public.site_switches (key, enabled) values ('post_conference', true) on conflict do nothing;

create or replace function public.post_conference_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.site_switches where key = 'post_conference'), false)
$$;
grant execute on function public.post_conference_open() to authenticated;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
insert into public.access_capabilities (key, label, description, sort) values
  ('moderate_gallery', 'Photo gallery', 'Accept or reject the photos people add to the gallery in My Hub, and take photos down.', 58),
  ('view_feedback', 'Conference feedback', 'Read everyone''s conference feedback, without names, and download it.', 59)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'moderate_gallery',
       t.account_type in ('supporting_committee', 'academic_team', 'publicity_team', 'finance_team', 'logistics_team',
                          'executive_committee', 'vice_president', 'president')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, 'view_feedback',
       t.account_type in ('executive_committee', 'vice_president', 'president')
  from (select unnest(enum_range(null::public.account_type))::text as account_type) t
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Feedback
-- ---------------------------------------------------------------------
create table if not exists public.conference_feedback (
  edition_id uuid not null references public.editions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Their roles when they answered, so answers can be split by delegates, presenters and so on.
  roles public.account_type[] not null default '{}',
  overall smallint not null check (overall between 1 and 5),
  recommend smallint not null check (recommend between 0 and 10),
  parts jsonb not null default '{}'::jsonb check (jsonb_typeof(parts) = 'object'),
  highlights text[] not null default '{}' check (cardinality(highlights) <= 30),
  highlight_note text check (char_length(highlight_note) <= 1000),
  improvements text[] not null default '{}' check (cardinality(improvements) <= 30),
  improve_note text check (char_length(improve_note) <= 1000),
  comments text check (char_length(comments) <= 1000),
  quote_ok boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (edition_id, user_id)
);
alter table public.conference_feedback enable row level security;
-- People see only their own answer. Nobody reads the table with names: the
-- committee uses conference_feedback_summary() below.
drop policy if exists "feedback: own read" on public.conference_feedback;
create policy "feedback: own read" on public.conference_feedback for select using (user_id = auth.uid());
revoke insert, update, delete on public.conference_feedback from anon, authenticated;

/** Sends feedback for the current edition. Once only. */
create or replace function public.submit_conference_feedback(
  p_overall int, p_recommend int, p_parts jsonb, p_highlights text[], p_highlight_note text,
  p_improvements text[], p_improve_note text, p_comments text, p_quote_ok boolean
) returns text language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  ed uuid := public.current_edition_id();
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then return 'signed_out'; end if;
  if not (me.account_status = 'approved' or me.role = 'admin') then return 'not_approved'; end if;
  if ed is null then return 'no_edition'; end if;
  insert into public.conference_feedback (edition_id, user_id, roles, overall, recommend, parts, highlights, highlight_note,
                                          improvements, improve_note, comments, quote_ok)
  values (ed, me.id, public.all_types(me.account_type, me.extra_types), p_overall, p_recommend, coalesce(p_parts, '{}'::jsonb),
          coalesce(p_highlights, '{}'), nullif(btrim(p_highlight_note), ''), coalesce(p_improvements, '{}'),
          nullif(btrim(p_improve_note), ''), nullif(btrim(p_comments), ''), coalesce(p_quote_ok, false))
  on conflict (edition_id, user_id) do nothing;
  return 'ok';
end $$;
revoke all on function public.submit_conference_feedback(int, int, jsonb, text[], text, text[], text, text, boolean) from public, anon;
grant execute on function public.submit_conference_feedback(int, int, jsonb, text[], text, text[], text, text, boolean) to authenticated;

/** Whether the signed-in person has given feedback this edition. */
create or replace function public.gave_feedback()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conference_feedback f where f.user_id = auth.uid() and f.edition_id = public.current_edition_id())
$$;
grant execute on function public.gave_feedback() to authenticated;

/**
 * Every answer for the current edition, without names or account ids, in a
 * random order, for people with the Conference feedback permission. Also the
 * number of approved accounts, for the response rate.
 */
create or replace function public.conference_feedback_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.has_access('view_feedback') then jsonb_build_object(
    'accounts', (select count(*) from public.profiles p where p.account_status = 'approved'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'roles', f.roles, 'overall', f.overall, 'recommend', f.recommend, 'parts', f.parts,
        'highlights', f.highlights, 'highlight_note', f.highlight_note,
        'improvements', f.improvements, 'improve_note', f.improve_note,
        'comments', f.comments, 'quote_ok', f.quote_ok, 'day', f.created_at::date
      ) order by md5(f.user_id::text || f.edition_id::text))
      from public.conference_feedback f where f.edition_id = public.current_edition_id()
    ), '[]'::jsonb)
  ) end
$$;
revoke all on function public.conference_feedback_summary() from public, anon;
grant execute on function public.conference_feedback_summary() to authenticated;

-- ---------------------------------------------------------------------
-- Gallery
-- ---------------------------------------------------------------------
create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references public.editions (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  path text not null unique,
  width int check (width between 1 and 10000),
  height int check (height between 1 and 10000),
  caption text check (char_length(caption) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  review_note text check (char_length(review_note) <= 300),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  report_note text check (char_length(report_note) <= 300),
  reported_by uuid references public.profiles (id) on delete set null,
  reported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gallery_path_check check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$' and split_part(path, '/', 1) = uploaded_by::text)
);
create index if not exists gallery_photos_status_idx on public.gallery_photos (status, created_at);
create index if not exists gallery_photos_owner_idx on public.gallery_photos (uploaded_by);
alter table public.gallery_photos enable row level security;

drop trigger if exists gallery_photos_audit on public.gallery_photos;
create trigger gallery_photos_audit after update or delete on public.gallery_photos for each row execute function public.audit_row_change();

/** Who can see accepted photos: the site owner, moderators, and approved accounts that have given feedback. */
create or replace function public.gallery_can_view()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_site_owner() or public.has_access('moderate_gallery') or exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.account_status = 'approved'
       and exists (select 1 from public.conference_feedback f where f.user_id = p.id and f.edition_id = public.current_edition_id())
  )
$$;
grant execute on function public.gallery_can_view() to authenticated;

drop policy if exists "gallery: accepted, own or moderators" on public.gallery_photos;
create policy "gallery: accepted, own or moderators" on public.gallery_photos for select using (
  uploaded_by = auth.uid()
  or public.has_access('moderate_gallery')
  or (status = 'accepted' and public.gallery_can_view())
);
-- People can remove their own photos; moderators can remove any.
drop policy if exists "gallery: own or moderators delete" on public.gallery_photos;
create policy "gallery: own or moderators delete" on public.gallery_photos for delete using (
  uploaded_by = auth.uid() or public.has_access('moderate_gallery')
);
revoke insert, update on public.gallery_photos from anon, authenticated;

/** The accepted photos, oldest first, with who shared each one. */
create or replace function public.gallery_feed()
returns table (id uuid, path text, width int, height int, caption text, credit text, created_at timestamptz, mine boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.path, g.width, g.height, g.caption,
         coalesce(nullif(btrim(p.full_name), ''), 'An INSPIRE delegate'), g.created_at, g.uploaded_by = auth.uid()
    from public.gallery_photos g
    left join public.profiles p on p.id = g.uploaded_by
   where g.status = 'accepted' and public.gallery_can_view()
   order by g.created_at, g.id
$$;
revoke all on function public.gallery_feed() from public, anon;
grant execute on function public.gallery_feed() to authenticated;

/**
 * Records a photo already uploaded to the person's own gallery folder. It
 * waits for the committee, unless they moderate the gallery themselves.
 */
create or replace function public.gallery_add(p_path text, p_width int, p_height int, p_caption text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  mod boolean := public.has_access('moderate_gallery') or public.is_site_owner();
  waiting int;
  new_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then return jsonb_build_object('error', 'signed_out'); end if;
  if not mod and not public.gallery_can_view() then return jsonb_build_object('error', 'not_allowed'); end if;
  if split_part(p_path, '/', 1) <> me.id::text then return jsonb_build_object('error', 'folder'); end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'gallery' and o.name = p_path) then
    return jsonb_build_object('error', 'missing');
  end if;
  select count(*) into waiting from public.gallery_photos where uploaded_by = me.id and status = 'pending';
  if not mod and waiting >= 40 then return jsonb_build_object('error', 'too_many'); end if;
  insert into public.gallery_photos (edition_id, uploaded_by, path, width, height, caption, status, reviewed_by, reviewed_at)
  values (public.current_edition_id(), me.id, p_path, p_width, p_height, nullif(left(btrim(p_caption), 200), ''),
          case when mod then 'accepted' else 'pending' end,
          case when mod then me.id end, case when mod then now() end)
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'status', case when mod then 'accepted' else 'pending' end);
end $$;
revoke all on function public.gallery_add(text, int, int, text) from public, anon;
grant execute on function public.gallery_add(text, int, int, text) to authenticated;

/** Photos for the committee to look at, with who added each one. Moderators only. */
create or replace function public.gallery_queue(p_status text)
returns table (id uuid, path text, width int, height int, caption text, status text, uploader text, uploader_email text,
               created_at timestamptz, review_note text, reviewed_at timestamptz, reviewer text, report_note text, reported_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.path, g.width, g.height, g.caption, g.status,
         coalesce(nullif(btrim(u.full_name), ''), u.email), u.email, g.created_at, g.review_note, g.reviewed_at,
         coalesce(nullif(btrim(r.full_name), ''), r.email), g.report_note, g.reported_at
    from public.gallery_photos g
    left join public.profiles u on u.id = g.uploaded_by
    left join public.profiles r on r.id = g.reviewed_by
   where (public.has_access('moderate_gallery') or public.is_site_owner())
     and (p_status = 'reported' and g.status = 'pending' and g.reported_at is not null
          or p_status <> 'reported' and g.status = p_status)
   order by case when p_status = 'pending' then g.created_at end asc,
            coalesce(g.reviewed_at, g.created_at) desc
   limit 500
$$;
revoke all on function public.gallery_queue(text) from public, anon;
grant execute on function public.gallery_queue(text) to authenticated;

/** A moderator accepts or rejects photos (several at once is fine). */
create or replace function public.gallery_review(p_ids uuid[], p_status text, p_note text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not (public.has_access('moderate_gallery') or public.is_site_owner()) then return -1; end if;
  if p_status not in ('accepted', 'rejected', 'pending') then return -1; end if;
  update public.gallery_photos
     set status = p_status,
         review_note = case when p_status = 'rejected' then nullif(left(btrim(p_note), 300), '') end,
         reviewed_by = auth.uid(), reviewed_at = now(),
         -- Accepting a reported photo clears the report; rejecting keeps it for the record.
         report_note = case when p_status = 'accepted' then null else report_note end,
         reported_by = case when p_status = 'accepted' then null else reported_by end,
         reported_at = case when p_status = 'accepted' then null else reported_at end
   where id = any(p_ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.gallery_review(uuid[], text, text) from public, anon;
grant execute on function public.gallery_review(uuid[], text, text) to authenticated;

/** Anyone who can see a photo asks for it to come down. It's hidden until the committee looks again. */
create or replace function public.gallery_report(p_id uuid, p_note text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.gallery_can_view() then return false; end if;
  update public.gallery_photos
     set status = 'pending', report_note = coalesce(nullif(left(btrim(p_note), 300), ''), 'Asked to take this down'),
         reported_by = auth.uid(), reported_at = now()
   where id = p_id and status = 'accepted';
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.gallery_report(uuid, text) from public, anon;
grant execute on function public.gallery_report(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Gallery files
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', false, 8 * 1024 * 1024, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gallery files: read" on storage.objects;
create policy "gallery files: read" on storage.objects for select using (
  bucket_id = 'gallery' and auth.uid() is not null and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_access('moderate_gallery')
    or (public.gallery_can_view() and exists (select 1 from public.gallery_photos g where g.path = name and g.status = 'accepted'))
  )
);
drop policy if exists "gallery files: upload own folder" on storage.objects;
create policy "gallery files: upload own folder" on storage.objects for insert with check (
  bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text
  and (public.gallery_can_view() or public.has_access('moderate_gallery'))
);
drop policy if exists "gallery files: own or moderators delete" on storage.objects;
create policy "gallery files: own or moderators delete" on storage.objects for delete using (
  bucket_id = 'gallery' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_access('moderate_gallery'))
);
