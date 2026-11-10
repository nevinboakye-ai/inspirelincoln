-- =====================================================================
-- Account types, account review, consent records, and slide and poster
-- submissions with committee feedback.
--
-- Access model
--   * Every account has an account_type (what the person is at INSPIRE)
--     and an account_status (pending, approved, waitlisted, declined).
--   * Committee powers only apply once an account is approved:
--       supporting committee  : edit site content, review submissions
--       executive committee   : plus accounts, registrations and other
--                               personal data
--       vice president, president: plus appointing executive members
--   * profiles.role is kept as a technical override for site admins.
-- =====================================================================

create type public.account_type as enum (
  'delegate', 'oral_presenter', 'poster_presenter',
  'supporting_committee', 'executive_committee', 'vice_president', 'president'
);
create type public.account_status as enum ('pending', 'approved', 'waitlisted', 'declined');

alter table public.profiles
  add column account_type public.account_type not null default 'delegate',
  add column account_status public.account_status not null default 'pending',
  add column career_stage text check (char_length(career_stage) <= 80),
  add column committee_position text check (char_length(committee_position) <= 120),
  add column presentation_title text check (char_length(presentation_title) <= 300),
  add column heard_about text check (char_length(heard_about) <= 120),
  add column accessibility_needs text check (char_length(accessibility_needs) <= 1000),
  add column dietary_requirements text check (char_length(dietary_requirements) <= 500),
  add column photo_opt_out boolean not null default false,
  add column marketing_opt_in boolean not null default false,
  add column review_note text check (char_length(review_note) <= 1000),
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz;

create index profiles_account_idx on public.profiles (account_status, account_type);

-- Deleting a committee member's account must not be blocked by check-ins or
-- review assignments they made.
alter table public.registrations drop constraint if exists registrations_checked_in_by_fkey,
  add constraint registrations_checked_in_by_fkey foreign key (checked_in_by) references auth.users (id) on delete set null;
alter table public.review_assignments drop constraint if exists review_assignments_assigned_by_fkey,
  add constraint review_assignments_assigned_by_fkey foreign key (assigned_by) references auth.users (id) on delete set null;

-- Anyone who already had an account before this change keeps working.
update public.profiles set account_status = 'approved';

-- ---------------------------------------------------------------------
-- Permission helpers. The old helpers are redefined so every existing
-- policy picks up committee access automatically.
-- ---------------------------------------------------------------------
create or replace function public.is_committee()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role in ('editor', 'admin')
      or (account_status = 'approved' and account_type in ('supporting_committee', 'executive_committee', 'vice_president', 'president'))
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.is_exec()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'admin'
      or (account_status = 'approved' and account_type in ('executive_committee', 'vice_president', 'president'))
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.is_leadership()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select role = 'admin' or (account_status = 'approved' and account_type in ('vice_president', 'president'))
    from public.profiles where id = auth.uid()
  ), false)
$$;

-- Executive members can see and manage personal data.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_exec()
$$;

-- Any committee member can edit public content.
create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_committee()
$$;

create or replace function public.is_reviewer()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'reviewer' from public.profiles where id = auth.uid()), false) or public.is_committee()
$$;

-- ---------------------------------------------------------------------
-- New accounts: copy the registration answers from sign-up metadata.
-- Special category data (access and dietary needs) is never sent in
-- metadata; people add it after signing in, with explicit consent.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  t public.account_type;
begin
  begin
    t := coalesce(nullif(m ->> 'account_type', ''), 'delegate')::public.account_type;
  exception when others then
    t := 'delegate';
  end;
  insert into public.profiles (
    id, email, full_name, institution, programme, year_of_study, career_stage,
    committee_position, presentation_title, heard_about, marketing_opt_in, photo_opt_out,
    account_type, account_status
  ) values (
    new.id, new.email,
    left(nullif(trim(m ->> 'full_name'), ''), 120),
    left(nullif(trim(m ->> 'institution'), ''), 160),
    left(nullif(trim(m ->> 'programme'), ''), 160),
    left(nullif(trim(m ->> 'year_of_study'), ''), 40),
    left(nullif(trim(m ->> 'career_stage'), ''), 80),
    left(nullif(trim(m ->> 'committee_position'), ''), 120),
    left(nullif(trim(m ->> 'presentation_title'), ''), 300),
    left(nullif(trim(m ->> 'heard_about'), ''), 120),
    coalesce((m ->> 'marketing_opt_in')::boolean, false),
    coalesce((m ->> 'photo_opt_out')::boolean, false),
    t, 'pending'
  );
  -- Record what the person agreed to, and which version of the policy they saw.
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

-- People cannot change their own account type, status or review fields,
-- and only leadership can appoint executive members, the vice president or the president.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_leadership() then
    raise exception 'Only the president, vice president or a site admin can change site roles';
  end if;
  if (new.account_type is distinct from old.account_type
      or new.account_status is distinct from old.account_status
      or new.review_note is distinct from old.review_note
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at) then
    if not public.is_exec() then
      raise exception 'Only the executive committee can review accounts';
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

-- Executive members need to see everyone's profile to review accounts.
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: read own or exec" on public.profiles for select using (id = auth.uid() or public.is_exec());
create policy "profiles: update own or exec" on public.profiles for update using (id = auth.uid() or public.is_exec());

-- ---------------------------------------------------------------------
-- Consent records: append-only history of what each person agreed to.
-- ---------------------------------------------------------------------
create table public.consent_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('privacy_notice', 'marketing_email', 'special_category', 'photography_opt_out')),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) <= 40),
  source text not null default 'portal' check (source in ('signup', 'portal')),
  created_at timestamptz not null default now()
);
create index consent_records_user_idx on public.consent_records (user_id, purpose, created_at desc);
alter table public.consent_records enable row level security;
create policy "consents: own read" on public.consent_records for select using (user_id = auth.uid() or public.is_exec());
create policy "consents: own insert" on public.consent_records for insert with check (user_id = auth.uid() and source = 'portal');
-- No update or delete policies: the history cannot be rewritten from the site.

-- Special category data may only be stored alongside a current explicit consent.
create or replace function public.guard_special_category()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
begin
  if coalesce(new.accessibility_needs, '') = '' and coalesce(new.dietary_requirements, '') = '' then
    return new;
  end if;
  if auth.uid() is null or auth.uid() <> new.id then
    -- Committee members can't add health or dietary details on someone's behalf.
    if tg_op = 'UPDATE' and new.accessibility_needs is not distinct from old.accessibility_needs
       and new.dietary_requirements is not distinct from old.dietary_requirements then
      return new;
    end if;
    if auth.uid() is not null then
      raise exception 'Only the account holder can add access or dietary needs';
    end if;
    return new;
  end if;
  select granted into ok from public.consent_records
    where user_id = new.id and purpose = 'special_category' order by created_at desc, id desc limit 1;
  if not coalesce(ok, false) then
    raise exception 'Explicit consent is needed before access or dietary needs can be saved';
  end if;
  return new;
end $$;
create trigger profiles_special_category before insert or update on public.profiles
  for each row execute function public.guard_special_category();

-- Withdrawing consent erases the details it covered.
create or replace function public.apply_consent_withdrawal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.purpose = 'special_category' and not new.granted then
    update public.profiles set accessibility_needs = null, dietary_requirements = null where id = new.user_id;
  elsif new.purpose = 'marketing_email' then
    update public.profiles set marketing_opt_in = new.granted where id = new.user_id;
  elsif new.purpose = 'photography_opt_out' then
    update public.profiles set photo_opt_out = new.granted where id = new.user_id;
  end if;
  return new;
end $$;
create trigger consent_records_apply after insert on public.consent_records
  for each row execute function public.apply_consent_withdrawal();

-- ---------------------------------------------------------------------
-- Account review: one call that updates the account and the conference
-- registration together, so the two can never disagree.
-- ---------------------------------------------------------------------
create or replace function public.review_account(
  target uuid,
  new_status public.account_status,
  new_type public.account_type default null,
  note text default null
)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  ed uuid;
  reg public.registration_status;
begin
  if not public.is_exec() then
    raise exception 'Not authorised';
  end if;
  select * into p from public.profiles where id = target;
  if not found then
    raise exception 'Account not found';
  end if;
  if target = auth.uid() and not public.is_leadership() then
    raise exception 'You cannot review your own account';
  end if;
  if (coalesce(new_type, p.account_type) in ('executive_committee', 'vice_president', 'president')
      or p.account_type in ('executive_committee', 'vice_president', 'president'))
     and new_status = 'approved' and not public.is_leadership() then
    raise exception 'Only the president or vice president can approve executive committee accounts';
  end if;

  update public.profiles
     set account_status = new_status,
         account_type = coalesce(new_type, account_type),
         review_note = left(nullif(trim(note), ''), 1000),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = target
   returning * into p;

  select id into ed from public.editions where is_current limit 1;
  if ed is not null then
    reg := case new_status
      when 'approved' then 'confirmed'::public.registration_status
      when 'waitlisted' then 'waitlisted'::public.registration_status
      when 'declined' then 'cancelled'::public.registration_status
      else 'pending'::public.registration_status end;
    insert into public.registrations (edition_id, user_id, status, source)
    values (ed, target, reg, 'manual')
    on conflict (edition_id, user_id) do update set status = excluded.status;
  end if;
  return p;
end $$;
revoke all on function public.review_account(uuid, public.account_status, public.account_type, text) from public, anon;
grant execute on function public.review_account(uuid, public.account_status, public.account_type, text) to authenticated;

-- ---------------------------------------------------------------------
-- Slide and poster submissions with committee feedback.
-- Each upload is a new version; earlier versions are kept for context.
-- ---------------------------------------------------------------------
create type public.submission_kind as enum ('slides', 'poster');
create type public.submission_status as enum ('submitted', 'changes_requested', 'approved');

create table public.presentation_submissions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references public.editions (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Copied from the profile so supporting committee members, who can't read profiles, know whose work it is.
  presenter_name text not null default '' check (char_length(presenter_name) <= 120),
  kind public.submission_kind not null,
  version int not null default 1,
  title text not null check (char_length(title) between 3 and 300),
  presenter_note text not null default '' check (char_length(presenter_note) <= 2000),
  file_path text not null check (char_length(file_path) <= 400),
  file_name text not null check (char_length(file_name) <= 200),
  file_type text not null check (char_length(file_type) <= 120),
  file_size bigint not null check (file_size > 0 and file_size <= 50 * 1024 * 1024),
  status public.submission_status not null default 'submitted',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, version)
);
create index presentation_submissions_status_idx on public.presentation_submissions (edition_id, kind, status, created_at desc);
create trigger presentation_submissions_touch before update on public.presentation_submissions
  for each row execute function public.touch_updated_at();
create trigger presentation_submissions_audit after insert or update or delete on public.presentation_submissions
  for each row execute function public.audit_row_change();

-- Number versions per person and kind, and keep presenters from setting decision fields.
create or replace function public.prepare_submission()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.version := coalesce((select max(version) from public.presentation_submissions where user_id = new.user_id and kind = new.kind), 0) + 1;
  new.status := 'submitted';
  new.presenter_name := coalesce((select full_name from public.profiles where id = new.user_id), '');
  new.decided_by := null;
  new.decided_at := null;
  if new.file_path not like new.user_id::text || '/%' then
    raise exception 'Files must be uploaded to your own folder';
  end if;
  return new;
end $$;
create trigger presentation_submissions_prepare before insert on public.presentation_submissions
  for each row execute function public.prepare_submission();

create table public.submission_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.presentation_submissions (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null default '' check (char_length(author_name) <= 160),
  decision text not null default 'comment' check (decision in ('comment', 'changes_requested', 'approved')),
  body text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  check (decision <> 'comment' or char_length(trim(body)) > 0)
);
create index submission_feedback_submission_idx on public.submission_feedback (submission_id, created_at);
create trigger submission_feedback_audit after insert or update or delete on public.submission_feedback
  for each row execute function public.audit_row_change();

-- Stamp the reviewer's name, and let a decision move the submission's status.
create or replace function public.apply_submission_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_id := auth.uid();
  new.author_name := coalesce((
    select coalesce(nullif(full_name, ''), 'INSPIRE committee')
      || case when committee_position is not null and committee_position <> '' then ', ' || committee_position else '' end
    from public.profiles where id = auth.uid()
  ), 'INSPIRE committee');
  if new.decision in ('changes_requested', 'approved') then
    update public.presentation_submissions
       set status = new.decision::public.submission_status, decided_by = auth.uid(), decided_at = now()
     where id = new.submission_id;
  end if;
  return new;
end $$;
create trigger submission_feedback_apply before insert on public.submission_feedback
  for each row execute function public.apply_submission_feedback();

-- Lets the server email a presenter about feedback without giving every committee member access to profiles.
create or replace function public.submission_presenter(sub uuid)
returns table (email text, full_name text)
language sql stable security definer set search_path = public as $$
  select p.email, p.full_name from public.presentation_submissions s join public.profiles p on p.id = s.user_id
  where s.id = sub and public.is_committee()
$$;
revoke all on function public.submission_presenter(uuid) from public, anon;
grant execute on function public.submission_presenter(uuid) to authenticated;

create or replace function public.can_submit(k public.submission_kind)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select account_status = 'approved' and (
      (k = 'slides' and account_type = 'oral_presenter') or (k = 'poster' and account_type = 'poster_presenter')
    ) from public.profiles where id = auth.uid()
  ), false)
$$;

alter table public.presentation_submissions enable row level security;
create policy "submissions: own or committee read" on public.presentation_submissions for select
  using (user_id = auth.uid() or public.is_committee());
create policy "submissions: approved presenter insert" on public.presentation_submissions for insert
  with check (user_id = auth.uid() and public.can_submit(kind));
create policy "submissions: exec delete" on public.presentation_submissions for delete using (public.is_exec());
-- No update policy: status changes only through feedback.

alter table public.submission_feedback enable row level security;
create policy "feedback: presenter or committee read" on public.submission_feedback for select using (
  public.is_committee() or exists (
    select 1 from public.presentation_submissions s where s.id = submission_id and s.user_id = auth.uid()
  )
);
create policy "feedback: committee write" on public.submission_feedback for insert with check (public.is_committee());
create policy "feedback: exec delete" on public.submission_feedback for delete using (public.is_exec());

-- Private storage for slides and posters. Paths start with the uploader's id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('submissions', 'submissions', false, 50 * 1024 * 1024, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.apple.keynote',
    'application/x-iwork-keynote-sffkey',
    'image/png',
    'image/jpeg'
  ])
on conflict (id) do nothing;

create policy "submissions files: owner or committee read" on storage.objects for select using (
  bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_committee())
);
create policy "submissions files: approved presenter upload" on storage.objects for insert with check (
  bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text
  and (public.can_submit('slides') or public.can_submit('poster'))
);
create policy "submissions files: exec delete" on storage.objects for delete using (
  bucket_id = 'submissions' and public.is_exec()
);

grant select, insert, delete on public.presentation_submissions to authenticated;
grant select, insert, delete on public.submission_feedback to authenticated;
grant select, insert on public.consent_records to authenticated;
grant usage on sequence public.consent_records_id_seq to authenticated;

-- ---------------------------------------------------------------------
-- Group emails sent by the president or vice president. Only a record of
-- what was sent and to which groups is kept, not the list of addresses.
-- ---------------------------------------------------------------------
create table public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references auth.users (id) on delete set null,
  sender_name text not null default '',
  subject text not null check (char_length(subject) between 3 and 160),
  body text not null check (char_length(body) between 10 and 10000),
  purpose text not null check (purpose in ('service', 'marketing')),
  audience_types public.account_type[] not null,
  audience_statuses public.account_status[] not null,
  recipient_count int not null default 0,
  delivered_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.email_broadcasts enable row level security;
create policy "broadcasts: leadership read" on public.email_broadcasts for select using (public.is_leadership());
create policy "broadcasts: leadership insert" on public.email_broadcasts for insert with check (public.is_leadership() and sent_by = auth.uid());
create policy "broadcasts: leadership update" on public.email_broadcasts for update using (public.is_leadership());
grant select, insert, update on public.email_broadcasts to authenticated;
create trigger email_broadcasts_audit after insert on public.email_broadcasts for each row execute function public.audit_row_change();

-- A waitlisted person's place in the queue, without revealing anyone else.
create or replace function public.my_waitlist_position()
returns int language sql stable security definer set search_path = public as $$
  select case when me.account_status = 'waitlisted' then (
    select count(*)::int + 1 from public.profiles o
    where o.account_status = 'waitlisted' and (o.created_at, o.id) < (me.created_at, me.id)
  ) end
  from public.profiles me where me.id = auth.uid()
$$;
revoke all on function public.my_waitlist_position() from public, anon;
grant execute on function public.my_waitlist_position() to authenticated;

-- Self-service account deletion (UK GDPR right to erasure) without needing
-- the service role key on the website. Deleting the auth user cascades to
-- the profile, registration, agenda, consents and submissions. Uploaded
-- files are removed by the website first, using the policy below.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create policy "private files: owner delete own folder" on storage.objects for delete using (
  bucket_id in ('abstracts', 'posters', 'submissions') and (storage.foldername(name))[1] = auth.uid()::text
);
