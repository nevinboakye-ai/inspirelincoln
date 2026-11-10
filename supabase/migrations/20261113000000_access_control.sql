-- =====================================================================
-- Access control the site owner can change.
--
-- Each permission ("capability") is granted to account types in
-- access_rules, and can be given to or taken from one person in
-- access_overrides. Only an approved account gets anything from its type.
-- The site owner (profiles.role = 'admin') always has every permission,
-- and is the only person who can change these tables.
--
-- The existing helpers that every security policy uses are redefined on
-- top of has_access(), so the whole database follows these choices:
--   is_editor()     -> edit_website
--   is_committee()  -> review_submissions
--   is_exec()       -> review_accounts
--   is_admin()      -> manage_people
--   is_leadership() -> approve_committee
-- =====================================================================

create table if not exists public.access_capabilities (
  key text primary key,
  label text not null,
  description text not null,
  sort int not null default 0
);

insert into public.access_capabilities (key, label, description, sort) values
  ('edit_website', 'Edit the website', 'Programme, speakers, committee, campus map, FAQs, announcements and conference settings.', 10),
  ('review_submissions', 'Review slides and posters', 'See presenters'' uploads and give feedback, request changes or approve them.', 20),
  ('review_accounts', 'Review accounts', 'See new registrations and approve, waitlist or decline them.', 30),
  ('approve_committee', 'Approve committee accounts', 'Approve executive committee, vice president and president accounts.', 40),
  ('manage_people', 'Delegate records', 'Registrations, abstracts, poster records, enquiries and the audit log. This is personal data.', 50),
  ('check_in', 'Check-in desk', 'Scan tickets and check people in on the day.', 60),
  ('send_email', 'Group emails', 'Send emails to groups of delegates, presenters or the committee.', 70)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

create table if not exists public.access_rules (
  account_type public.account_type not null,
  capability text not null references public.access_capabilities(key) on delete cascade,
  allowed boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (account_type, capability)
);

-- Defaults match how the site worked before this change.
insert into public.access_rules (account_type, capability, allowed)
select t.account_type::public.account_type, c.key,
  case
    when c.key in ('edit_website', 'review_submissions')
      then t.account_type in ('supporting_committee', 'executive_committee', 'vice_president', 'president')
    when c.key in ('review_accounts', 'manage_people', 'check_in')
      then t.account_type in ('executive_committee', 'vice_president', 'president')
    when c.key in ('approve_committee', 'send_email')
      then t.account_type in ('vice_president', 'president')
    else false
  end
from (select unnest(enum_range(null::public.account_type))::text as account_type) t
cross join public.access_capabilities c
on conflict do nothing;

create table if not exists public.access_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null references public.access_capabilities(key) on delete cascade,
  allowed boolean not null,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, capability)
);

-- ---------------------------------------------------------------------
-- The check every policy goes through.
-- ---------------------------------------------------------------------
create or replace function public.has_access(cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when p.role = 'admin' then true
      when o.allowed is not null then o.allowed and p.account_status <> 'declined'
      when p.account_status <> 'approved' then
        -- Legacy site roles still work for people outside the committee.
        (p.role = 'editor' and cap in ('edit_website', 'review_submissions'))
      else coalesce(r.allowed, false)
        or (p.role = 'editor' and cap in ('edit_website', 'review_submissions'))
    end
    from public.profiles p
    left join public.access_overrides o on o.user_id = p.id and o.capability = cap
    left join public.access_rules r on r.account_type = p.account_type and r.capability = cap
    where p.id = auth.uid()
  ), false)
$$;

-- Every permission the signed-in person has, for the website to show the right things.
create or replace function public.my_access()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.key order by c.sort), '{}')
  from public.access_capabilities c
  where public.has_access(c.key)
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('edit_website')
$$;

create or replace function public.is_committee()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('review_submissions')
$$;

create or replace function public.is_exec()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('review_accounts')
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('manage_people')
$$;

create or replace function public.is_leadership()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('approve_committee')
$$;

-- Group emails get their own permission.
drop policy if exists "broadcasts: leadership read" on public.email_broadcasts;
drop policy if exists "broadcasts: leadership insert" on public.email_broadcasts;
drop policy if exists "broadcasts: leadership update" on public.email_broadcasts;
drop policy if exists "broadcasts: senders read" on public.email_broadcasts;
drop policy if exists "broadcasts: senders insert" on public.email_broadcasts;
drop policy if exists "broadcasts: senders update" on public.email_broadcasts;
create policy "broadcasts: senders read" on public.email_broadcasts for select using (public.has_access('send_email'));
create policy "broadcasts: senders insert" on public.email_broadcasts for insert with check (public.has_access('send_email') and sent_by = auth.uid());
create policy "broadcasts: senders update" on public.email_broadcasts for update using (public.has_access('send_email'));

-- People who send group emails can count and reach recipients without
-- being able to browse everyone's profile.
create or replace function public.audience_counts()
returns table (account_type public.account_type, account_status public.account_status, total bigint, marketing bigint)
language sql stable security definer set search_path = public as $$
  select p.account_type, p.account_status, count(*), count(*) filter (where p.marketing_opt_in)
  from public.profiles p
  where public.has_access('send_email') or public.has_access('review_accounts')
  group by 1, 2
$$;

create or replace function public.broadcast_recipients(types public.account_type[], statuses public.account_status[], marketing_only boolean)
returns table (email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_access('send_email') then
    raise exception 'Not authorised';
  end if;
  return query
    select p.email, p.full_name from public.profiles p
    where p.account_type = any(types) and p.account_status = any(statuses)
      and p.email is not null and (not marketing_only or p.marketing_opt_in)
    limit 5000;
end $$;

-- Check-in desk volunteers can check people in without seeing every registration.
create or replace function public.check_in(token uuid)
returns table (registration_id uuid, full_name text, status public.registration_status, already_checked_in boolean, checked_in_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  r public.registrations;
  prior timestamptz;
begin
  if not (public.has_access('check_in') or public.has_access('manage_people')) then
    raise exception 'Not authorised';
  end if;
  select * into r from public.registrations where checkin_token = token;
  if not found then
    return;
  end if;
  prior := r.checked_in_at;
  if r.status = 'confirmed' and r.checked_in_at is null then
    update public.registrations set checked_in_at = now(), checked_in_by = auth.uid() where id = r.id returning * into r;
  end if;
  return query select r.id, p.full_name, r.status, prior is not null, r.checked_in_at
    from public.profiles p where p.id = r.user_id;
end $$;

create or replace function public.checkin_counts()
returns table (confirmed bigint, checked_in bigint)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where r.status = 'confirmed'), count(*) filter (where r.checked_in_at is not null)
  from public.registrations r
  join public.editions e on e.id = r.edition_id and e.is_current
  where public.has_access('check_in') or public.has_access('manage_people')
$$;

-- ---------------------------------------------------------------------
-- Only the site owner can read or change who has which permission.
-- Everyone can read the list of capabilities (it holds no personal data).
-- ---------------------------------------------------------------------
alter table public.access_capabilities enable row level security;
alter table public.access_rules enable row level security;
alter table public.access_overrides enable row level security;

drop policy if exists "capabilities: read" on public.access_capabilities;
create policy "capabilities: read" on public.access_capabilities for select using (true);

drop policy if exists "access rules: owner" on public.access_rules;
create policy "access rules: owner" on public.access_rules for all
  using (public.is_site_owner()) with check (public.is_site_owner());

drop policy if exists "access overrides: owner or self read" on public.access_overrides;
drop policy if exists "access overrides: owner write" on public.access_overrides;
create policy "access overrides: owner or self read" on public.access_overrides for select
  using (public.is_site_owner() or user_id = auth.uid());
create policy "access overrides: owner write" on public.access_overrides for all
  using (public.is_site_owner()) with check (public.is_site_owner());

create or replace function public.stamp_access_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists access_rules_stamp on public.access_rules;
create trigger access_rules_stamp before insert or update on public.access_rules
  for each row execute function public.stamp_access_change();
drop trigger if exists access_overrides_stamp on public.access_overrides;
create trigger access_overrides_stamp before insert or update on public.access_overrides
  for each row execute function public.stamp_access_change();

drop trigger if exists access_rules_audit on public.access_rules;
create trigger access_rules_audit after insert or update or delete on public.access_rules
  for each row execute function public.audit_row_change();
drop trigger if exists access_overrides_audit on public.access_overrides;
create trigger access_overrides_audit after insert or update or delete on public.access_overrides
  for each row execute function public.audit_row_change();

grant select on public.access_capabilities to anon, authenticated;
grant select, insert, update, delete on public.access_rules, public.access_overrides to authenticated;
