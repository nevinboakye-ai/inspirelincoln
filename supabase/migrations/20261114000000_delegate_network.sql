-- =====================================================================
-- Selected delegates and the delegate network.
--
--   * delegate_roster holds the people the committee has already
--     selected. When someone on it sets up their account (with the email
--     they applied with) they are approved straight away, with their
--     name, university, year and presentation filled in. Anyone else who
--     registers still goes through account review.
--   * The network: approved accounts are listed to each other by name,
--     university and year. A bio, LinkedIn and email only appear when
--     the person adds them, and anyone can hide themselves completely.
--
-- The roster itself is personal data, so it is loaded separately (from a
-- private file) and is never committed to the repository.
-- =====================================================================

create table if not exists public.delegate_roster (
  email text primary key check (email = lower(email) and email like '%@%'),
  full_name text not null check (char_length(full_name) <= 120),
  institution text check (char_length(institution) <= 160),
  year_of_study text check (char_length(year_of_study) <= 40),
  account_type public.account_type not null default 'delegate'
    check (account_type in ('delegate', 'oral_presenter', 'poster_presenter')),
  presentation_title text check (char_length(presentation_title) <= 300),
  note text check (char_length(note) <= 1000),
  added_at timestamptz not null default now()
);
alter table public.delegate_roster enable row level security;

drop policy if exists "roster: reviewers read" on public.delegate_roster;
drop policy if exists "roster: reviewers write" on public.delegate_roster;
create policy "roster: reviewers read" on public.delegate_roster for select using (public.has_access('review_accounts'));
create policy "roster: reviewers write" on public.delegate_roster for all
  using (public.has_access('review_accounts')) with check (public.has_access('review_accounts'));

-- ---------------------------------------------------------------------
-- Network card fields on profiles.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists bio text check (char_length(bio) <= 600),
  add column if not exists linkedin_url text
    check (char_length(linkedin_url) <= 200 and linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/'),
  add column if not exists network_show_email boolean not null default false,
  add column if not exists network_listed boolean not null default true;

-- ---------------------------------------------------------------------
-- New accounts: people on the roster are approved with their details.
-- Everything else is unchanged from the previous version.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  t public.account_type;
  r public.delegate_roster%rowtype;
begin
  begin
    t := coalesce(nullif(m ->> 'account_type', ''), 'delegate')::public.account_type;
  exception when others then
    t := 'delegate';
  end;
  select * into r from public.delegate_roster where email = lower(new.email);
  insert into public.profiles (
    id, email, full_name, institution, programme, year_of_study, career_stage,
    committee_position, presentation_title, heard_about, marketing_opt_in, photo_opt_out,
    account_type, account_status, review_note, reviewed_at
  ) values (
    new.id, new.email,
    coalesce(r.full_name, left(nullif(trim(m ->> 'full_name'), ''), 120)),
    coalesce(r.institution, left(nullif(trim(m ->> 'institution'), ''), 160)),
    left(nullif(trim(m ->> 'programme'), ''), 160),
    coalesce(r.year_of_study, left(nullif(trim(m ->> 'year_of_study'), ''), 40)),
    left(nullif(trim(m ->> 'career_stage'), ''), 80),
    case when r.email is null then left(nullif(trim(m ->> 'committee_position'), ''), 120) end,
    coalesce(r.presentation_title, left(nullif(trim(m ->> 'presentation_title'), ''), 300)),
    left(nullif(trim(m ->> 'heard_about'), ''), 120),
    coalesce((m ->> 'marketing_opt_in')::boolean, false),
    coalesce((m ->> 'photo_opt_out')::boolean, false),
    coalesce(r.account_type, t),
    case when r.email is null then 'pending'::public.account_status else 'approved' end,
    case when r.email is not null then 'On the selected delegate list' end,
    case when r.email is not null then now() end
  );
  if coalesce((m ->> 'privacy_ack')::boolean, false) then
    insert into public.consent_records (user_id, purpose, granted, policy_version, source)
    values (new.id, 'privacy_notice', true, coalesce(m ->> 'policy_version', 'unknown'), 'signup');
  end if;
  insert into public.consent_records (user_id, purpose, granted, policy_version, source)
  values (new.id, 'marketing_email', coalesce((m ->> 'marketing_opt_in')::boolean, false), coalesce(m ->> 'policy_version', 'unknown'), 'signup');
  if coalesce((m ->> 'photo_opt_out')::boolean, false) then
    insert into public.consent_records (user_id, purpose, granted, policy_version, source)
    values (new.id, 'photography_opt_out', true, coalesce(m ->> 'policy_version', 'unknown'), 'signup');
  end if;
  return new;
end $$;

-- People added to the roster after they registered are approved too.
-- Runs as the database (no signed-in user), so the review guard allows it.
create or replace function public.apply_roster_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('inspire.roster_apply', 'on', true);
  update public.profiles p
     set account_status = 'approved',
         account_type = case when p.account_type in ('delegate', 'oral_presenter', 'poster_presenter') then new.account_type else p.account_type end,
         full_name = coalesce(p.full_name, new.full_name),
         institution = coalesce(p.institution, new.institution),
         year_of_study = coalesce(p.year_of_study, new.year_of_study),
         presentation_title = coalesce(p.presentation_title, new.presentation_title),
         review_note = coalesce(p.review_note, 'On the selected delegate list'),
         reviewed_at = coalesce(p.reviewed_at, now())
   where lower(p.email) = new.email
     and p.account_status in ('pending', 'waitlisted');
  perform set_config('inspire.roster_apply', 'off', true);
  return new;
end $$;

drop trigger if exists delegate_roster_apply on public.delegate_roster;
create trigger delegate_roster_apply after insert or update on public.delegate_roster
  for each row execute function public.apply_roster_entry();

-- The review guard checks auth.uid(); the roster trigger runs inside a
-- reviewer's request, so it sets a flag for the length of its own update.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or current_setting('inspire.roster_apply', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_site_owner() then
    raise exception 'Only the site owner can change site roles';
  end if;
  if (new.account_type is distinct from old.account_type
      or new.account_status is distinct from old.account_status
      or new.review_note is distinct from old.review_note
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at) then
    if not public.is_exec() then
      raise exception 'Only the executive committee can review accounts';
    end if;
    if old.role = 'admin' and not public.is_site_owner() then
      raise exception 'Only the site owner can change the site owner''s account';
    end if;
    if new.id = auth.uid() and not public.is_leadership() then
      raise exception 'You cannot review your own account';
    end if;
    if (new.account_type in ('executive_committee', 'vice_president', 'president')
        or old.account_type in ('executive_committee', 'vice_president', 'president'))
       and new.account_status = 'approved'
       and not public.is_leadership() then
      raise exception 'Only the president or vice president can approve executive committee accounts';
    end if;
  end if;
  if new.email is distinct from old.email and not public.is_exec() then
    new.email = old.email;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- The network directory. Only approved accounts (and site admins) can
-- read it, and it only returns what each person has chosen to share.
-- ---------------------------------------------------------------------
create or replace function public.network_directory()
returns table (
  id uuid, full_name text, institution text, year_of_study text, account_type public.account_type,
  committee_position text, bio text, linkedin_url text, email text
)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.institution, p.year_of_study, p.account_type,
         case when p.account_type in ('supporting_committee', 'executive_committee', 'vice_president', 'president') then p.committee_position end,
         p.bio, p.linkedin_url,
         case when p.network_show_email then p.email end
    from public.profiles p
   where p.network_listed
     and p.account_status = 'approved'
     and p.full_name is not null
     and exists (select 1 from public.profiles me where me.id = auth.uid() and (me.account_status = 'approved' or me.role = 'admin'))
   order by lower(p.full_name)
$$;
revoke all on function public.network_directory() from public, anon;
grant execute on function public.network_directory() to authenticated;
