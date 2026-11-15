-- =====================================================================
-- Access to every area of the site, and removing accounts.
--
-- 1. Areas. "Edit the website" used to cover every page of the website at
--    once, and a few dashboard pages rode on another permission (presenter
--    attendance and travel on "Review accounts", the audit log on
--    "Delegate records"). Each of those is now its own permission, so the
--    site owner can give or take away each area per account type or per
--    person on the platform dashboard. Nobody gains or loses anything when
--    this runs: every new permission starts as a copy of the one it came
--    from, for account types and for individual changes alike.
--
--      edit_programme      Programme sessions and rooms
--      edit_speakers       Speakers
--      edit_workshops      Workshops (the pages, not the places)
--      edit_announcements  Announcements
--      edit_committee      Committee profiles
--      edit_map            Campus map
--      edit_sponsors       Sponsors, partners and university logos
--      edit_faqs           FAQs
--      edit_settings       Conference settings and editions
--      edit_website        Other pages: history, gallery, resources, opportunities
--      view_attendance     Presenter attendance
--      view_travel         Travel and parking
--      view_audit_log      Audit log
--      remove_accounts     Remove accounts (nobody but the site owner to start with)
--
--    The database enforces each one: content tables are written only by
--    people with that area, and the new pages read people through a
--    narrow view rather than whole profiles.
--
-- 2. Removing accounts. public.remove_account() permanently deletes
--    someone's account and everything linked to it, optionally takes them
--    off the selected delegate list too, and writes it to the audit log.
--
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- New permissions
-- ---------------------------------------------------------------------
insert into public.access_capabilities (key, label, description, sort) values
  ('edit_programme', 'Programme', 'Programme sessions, times, rooms and the speakers on each session.', 11),
  ('edit_speakers', 'Speakers', 'Speaker profiles, photos and biographies.', 12),
  ('edit_workshops', 'Workshop pages', 'Workshop descriptions, facilitators and what to bring.', 13),
  ('edit_announcements', 'Announcements', 'Announcements shown on the website and in My Hub.', 14),
  ('edit_committee', 'Committee profiles', 'Names, roles, photos and biographies on the About page.', 15),
  ('edit_map', 'Campus map', 'Places, pins and rooms on the campus map.', 16),
  ('edit_sponsors', 'Sponsors and logos', 'Sponsors, partner institutions and university logos.', 17),
  ('edit_faqs', 'FAQs', 'Questions and answers on the website.', 18),
  ('edit_settings', 'Conference settings', 'Conference status, dates, registration, deadlines, modes and editions.', 19),
  ('view_attendance', 'Presenter attendance', 'Which presenters have confirmed they''re coming, and the oral waiting list.', 32),
  ('view_travel', 'Travel and parking', 'How delegates are travelling and their car registrations for parking.', 33),
  ('view_audit_log', 'Audit log', 'The record of every change made on the dashboard.', 55),
  ('remove_accounts', 'Remove accounts', 'Permanently delete someone''s account and everything linked to it.', 45)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

update public.access_capabilities
   set label = 'Other website pages',
       description = 'History timeline, gallery, resources and opportunities.'
 where key = 'edit_website';

-- Each new permission starts as a copy of the one it came from.
with parent(cap, from_caps) as (
  values
    ('edit_programme', array['edit_website']),
    ('edit_speakers', array['edit_website']),
    ('edit_workshops', array['edit_website']),
    ('edit_announcements', array['edit_website']),
    ('edit_committee', array['edit_website']),
    ('edit_map', array['edit_website']),
    ('edit_sponsors', array['edit_website']),
    ('edit_faqs', array['edit_website']),
    ('edit_settings', array['edit_website']),
    ('view_attendance', array['review_accounts']),
    ('view_travel', array['review_accounts', 'manage_people']),
    ('view_audit_log', array['manage_people'])
)
insert into public.access_rules (account_type, capability, allowed)
select t.account_type, parent.cap,
       exists (select 1 from public.access_rules r where r.account_type = t.account_type and r.capability = any(parent.from_caps) and r.allowed)
  from parent
 cross join (select unnest(enum_range(null::public.account_type)) as account_type) t
on conflict (account_type, capability) do nothing;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type, 'remove_accounts', false
  from (select unnest(enum_range(null::public.account_type)) as account_type) t
on conflict (account_type, capability) do nothing;

-- Individual changes carry over too: someone given "Edit the website" on
-- their own keeps every website area; someone blocked from it stays blocked.
with parent(cap, from_cap) as (
  values
    ('edit_programme', 'edit_website'), ('edit_speakers', 'edit_website'), ('edit_workshops', 'edit_website'),
    ('edit_announcements', 'edit_website'), ('edit_committee', 'edit_website'), ('edit_map', 'edit_website'),
    ('edit_sponsors', 'edit_website'), ('edit_faqs', 'edit_website'), ('edit_settings', 'edit_website'),
    ('view_attendance', 'review_accounts'), ('view_travel', 'review_accounts'), ('view_audit_log', 'manage_people')
)
insert into public.access_overrides (user_id, capability, allowed, note)
select o.user_id, parent.cap, o.allowed, o.note
  from public.access_overrides o
  join parent on parent.from_cap = o.capability
on conflict (user_id, capability) do nothing;

-- ---------------------------------------------------------------------
-- The check every policy goes through. Unchanged apart from old "editor"
-- site roles, which still get every website area.
-- ---------------------------------------------------------------------
create or replace function public.website_capabilities()
returns text[] language sql immutable as $$
  select array['edit_website', 'edit_programme', 'edit_speakers', 'edit_workshops', 'edit_announcements',
               'edit_committee', 'edit_map', 'edit_sponsors', 'edit_faqs', 'edit_settings']
$$;

create or replace function public.has_access(cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when p.role = 'admin' then true
      when o.allowed is not null then o.allowed and p.account_status <> 'declined'
      when p.account_status <> 'approved' then
        (p.role = 'editor' and (cap = 'review_submissions' or cap = any(public.website_capabilities())))
      else exists (
          select 1 from public.access_rules r
           where r.account_type = any(public.all_types(p.account_type, p.extra_types))
             and r.capability = cap and r.allowed
        )
        or (p.role = 'editor' and (cap = 'review_submissions' or cap = any(public.website_capabilities())))
    end
    from public.profiles p
    left join public.access_overrides o on o.user_id = p.id and o.capability = cap
    where p.id = auth.uid()
  ), false)
$$;

-- Every permission the signed-in person has. "areas_v1" tells the website
-- this file has run, so it knows the area permissions are real answers.
create or replace function public.my_access()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.key order by c.sort), '{}') || array['areas_v1']
  from public.access_capabilities c
  where public.has_access(c.key)
$$;

-- "Can edit some part of the website": seeing unpublished content and
-- uploading images. Writing each kind of content needs that area.
create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from unnest(public.website_capabilities()) c where public.has_access(c))
$$;

-- ---------------------------------------------------------------------
-- Content tables: each written by its own area.
-- ---------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('sessions', 'sessions: editors write', 'edit_programme'),
      ('rooms', 'rooms: editors write', 'edit_programme'),
      ('speakers', 'speakers: editors write', 'edit_speakers'),
      ('workshops', 'workshops: editors write', 'edit_workshops'),
      ('announcements', 'announcements: editors write', 'edit_announcements'),
      ('committee_members', 'committee: editors write', 'edit_committee'),
      ('map_places', 'map_places: editors write', 'edit_map'),
      ('sponsors', 'sponsors: editors write', 'edit_sponsors'),
      ('partners', 'partners: editors write', 'edit_sponsors'),
      ('university_logos', 'university logos: editors write', 'edit_sponsors'),
      ('faqs', 'faqs: editors write', 'edit_faqs'),
      ('editions', 'editions: editors write', 'edit_settings'),
      ('site_content', 'site_content: editors write', 'edit_settings'),
      ('opportunities', 'opportunities: editors write', 'edit_website'),
      ('gallery_assets', 'gallery: editors write', 'edit_website'),
      ('timeline_events', 'timeline: editors write', 'edit_website'),
      ('resources', 'resources: editors write', 'edit_website')
    ) as x(tbl, old_policy, cap)
  loop
    if to_regclass('public.' || t.tbl) is null then
      continue;
    end if;
    execute format('drop policy if exists %I on public.%I', t.old_policy, t.tbl);
    execute format('drop policy if exists %I on public.%I', t.tbl || ': area editors write', t.tbl);
    execute format(
      'create policy %I on public.%I for all using (public.has_access(%L)) with check (public.has_access(%L))',
      t.tbl || ': area editors write', t.tbl, t.cap, t.cap
    );
  end loop;
end $$;

-- Speakers on a session are set from the programme or the speaker's page.
drop policy if exists "session_speakers: editors write" on public.session_speakers;
drop policy if exists "session_speakers: area editors write" on public.session_speakers;
create policy "session_speakers: area editors write" on public.session_speakers for all
  using (public.has_access('edit_programme') or public.has_access('edit_speakers'))
  with check (public.has_access('edit_programme') or public.has_access('edit_speakers'));

-- ---------------------------------------------------------------------
-- People, for the pages that list them without needing whole profiles
-- (which hold access and dietary needs). Only the columns those pages use.
-- ---------------------------------------------------------------------
create or replace view public.staff_people as
  select p.id, p.email, p.full_name, p.institution, p.year_of_study, p.account_type, p.extra_types,
         p.account_status, p.role, p.presentation_title, p.committee_position, p.created_at
    from public.profiles p
   where public.has_access('review_accounts')
      or public.has_access('manage_people')
      or public.has_access('view_attendance')
      or public.has_access('view_travel')
      or public.has_access('view_audit_log')
      or public.has_access('remove_accounts')
      or public.has_access('send_email');
revoke all on public.staff_people from anon;
grant select on public.staff_people to authenticated;

drop policy if exists "attendance: attendance viewers read" on public.presenter_attendance;
create policy "attendance: attendance viewers read" on public.presenter_attendance
  for select using (public.has_access('view_attendance'));

drop policy if exists "roster: attendance viewers read" on public.delegate_roster;
create policy "roster: attendance viewers read" on public.delegate_roster
  for select using (public.has_access('view_attendance'));

drop policy if exists "travel: travel viewers read" on public.delegate_travel;
create policy "travel: travel viewers read" on public.delegate_travel
  for select using (public.has_access('view_travel'));

drop policy if exists "audit: audit viewers read" on public.audit_events;
create policy "audit: audit viewers read" on public.audit_events
  for select using (public.has_access('view_audit_log'));

-- ---------------------------------------------------------------------
-- Removing accounts
-- ---------------------------------------------------------------------

-- Two older links to an account would otherwise stop it being deleted.
alter table public.registrations drop constraint if exists registrations_checked_in_by_fkey;
alter table public.registrations add constraint registrations_checked_in_by_fkey
  foreign key (checked_in_by) references auth.users (id) on delete set null;
alter table public.review_assignments drop constraint if exists review_assignments_assigned_by_fkey;
alter table public.review_assignments add constraint review_assignments_assigned_by_fkey
  foreign key (assigned_by) references auth.users (id) on delete set null;

/**
 * Permanently deletes someone's account. Everything linked to it goes with
 * it (profile, Delegate Card, agenda, submissions, answers, enquiries).
 * With unlist, they also come off the selected delegate list, so setting up
 * an account again doesn't approve them straight away.
 *
 * Nobody can remove their own account here (that's in their profile), the
 * site owner's, or an executive committee account without being able to
 * approve committee accounts.
 */
create or replace function public.remove_account(target uuid, unlist boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  listed boolean := false;
begin
  if auth.uid() is null or not public.has_access('remove_accounts') then
    raise exception 'NOT_ALLOWED';
  end if;
  if target = auth.uid() then
    raise exception 'NOT_SELF';
  end if;
  select * into p from public.profiles where id = target;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if p.role = 'admin' then
    raise exception 'SITE_OWNER';
  end if;
  if public.all_types(p.account_type, p.extra_types) && array['executive_committee', 'vice_president', 'president']::public.account_type[]
     and not public.has_access('approve_committee') then
    raise exception 'LEADERSHIP_ONLY';
  end if;

  if unlist and p.email is not null then
    delete from public.delegate_roster where email = lower(p.email);
    listed := found;
  end if;

  insert into public.audit_events (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'remove_account', 'profiles', target::text,
          jsonb_build_object('name', p.full_name, 'account_type', p.account_type, 'account_status', p.account_status,
                             'unlisted', listed));

  delete from auth.users where id = target;
  return jsonb_build_object('name', p.full_name, 'email', p.email, 'unlisted', listed);
end $$;
revoke all on function public.remove_account(uuid, boolean) from public, anon;
grant execute on function public.remove_account(uuid, boolean) to authenticated;

-- Their uploaded files are removed by the website first. People who can
-- remove accounts may list and delete files in the private folders.
drop policy if exists "private files: account removers read" on storage.objects;
create policy "private files: account removers read" on storage.objects for select using (
  bucket_id in ('abstracts', 'posters', 'submissions', 'avatars') and public.has_access('remove_accounts')
);
drop policy if exists "private files: account removers delete" on storage.objects;
create policy "private files: account removers delete" on storage.objects for delete using (
  bucket_id in ('abstracts', 'posters', 'submissions', 'avatars') and public.has_access('remove_accounts')
);
