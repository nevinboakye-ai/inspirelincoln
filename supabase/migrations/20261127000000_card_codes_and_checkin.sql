-- =====================================================================
-- One QR code per person, on the back of their Delegate Card.
--
--   * Each profile gets a private, random card code. The QR holds only a
--     link with that code, never personal details. A person can replace
--     their code at any time, and the old one stops working.
--   * A confirmed delegate who scans someone's card sees that person's
--     details (only what they've chosen to share) and can save them to
--     "People I've met", with a private note. Anyone can turn sharing off.
--   * Committee members with the check-in permission scan the same code
--     on the day to confirm attendance. Approved people without a
--     registration row (for example those from the selected list) are
--     registered as they are checked in.
-- =====================================================================

-- Card codes: 16 characters from an alphabet without look-alikes (no 0, 1,
-- l or o), so they can also be typed. 80 random bits each.
create or replace function public.new_card_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  b bytea := extensions.gen_random_bytes(16);
  out text := '';
begin
  for i in 0..15 loop
    out := out || substr(alphabet, (get_byte(b, i) & 31) + 1, 1);
  end loop;
  return out;
end $$;

alter table public.profiles
  add column if not exists card_code text,
  add column if not exists card_shared boolean not null default true;
update public.profiles set card_code = public.new_card_code() where card_code is null;
alter table public.profiles
  alter column card_code set default public.new_card_code(),
  alter column card_code set not null;
alter table public.profiles drop constraint if exists profiles_card_code_format;
alter table public.profiles add constraint profiles_card_code_format check (card_code ~ '^[a-km-np-z2-9]{16}$');
create unique index if not exists profiles_card_code_key on public.profiles (card_code);

-- The code only changes through new_my_card_code(), never by a direct update.
create or replace function public.guard_card_code()
returns trigger language plpgsql as $$
begin
  if new.card_code is distinct from old.card_code and coalesce(current_setting('inspire.card_reset', true), '') <> 'on' then
    new.card_code := old.card_code;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_card_code on public.profiles;
create trigger profiles_guard_card_code before update on public.profiles for each row execute function public.guard_card_code();

create or replace function public.new_my_card_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  perform set_config('inspire.card_reset', 'on', true);
  update public.profiles set card_code = public.new_card_code() where id = auth.uid() returning card_code into c;
  perform set_config('inspire.card_reset', 'off', true);
  return c;
end $$;

-- ---------------------------------------------------------------------
-- People I've met. Private to the person who saved them. Removed with
-- either account.
-- ---------------------------------------------------------------------
create table if not exists public.saved_contacts (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 500),
  saved_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
create index if not exists saved_contacts_contact on public.saved_contacts (contact_id);
alter table public.saved_contacts enable row level security;
drop policy if exists "saved contacts: own read" on public.saved_contacts;
drop policy if exists "saved contacts: own update" on public.saved_contacts;
drop policy if exists "saved contacts: own delete" on public.saved_contacts;
-- Saving goes through save_contact(), which checks the card can be seen.
create policy "saved contacts: own read" on public.saved_contacts for select using (owner_id = auth.uid());
create policy "saved contacts: own update" on public.saved_contacts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "saved contacts: own delete" on public.saved_contacts for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.clean_card_code(raw text)
returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function public.can_check_in()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('check_in') or public.has_access('manage_people') or public.is_site_owner()
$$;

-- What a card shows to someone allowed to see it. Email only if they chose
-- to show it; a presentation title only for oral and poster presenters.
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
      then t.presentation_title end
  )
$$;

-- Attendance for the current conference, for the check-in desk.
create or replace function public.attendance_json(target uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'account_status', p.account_status,
    'registration', r.status,
    'checked_in_at', r.checked_in_at,
    'checked_in_by', (select full_name from public.profiles b where b.id = r.checked_in_by)
  )
  from public.profiles p
  left join public.editions e on e.is_current
  left join public.registrations r on r.user_id = p.id and r.edition_id = e.id
  where p.id = target
$$;

-- ---------------------------------------------------------------------
-- Scanning a card.
--   state: signed_out | unknown | not_member | cards_off | hidden | ok | self
--   card:  the shared details (ok and self only)
--   checkin: for check-in staff, who the code belongs to and their attendance
-- ---------------------------------------------------------------------
create or replace function public.card_lookup(code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me public.profiles;
  t public.profiles;
  staff boolean;
  committee boolean;
  cards_live boolean;
  s public.saved_contacts;
  state text;
  out jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('state', 'signed_out');
  end if;
  select * into me from public.profiles where id = auth.uid();
  select * into t from public.profiles where card_code = public.clean_card_code(code);
  staff := public.can_check_in();
  if t.id is null or (t.account_status <> 'approved' and not staff) then
    return jsonb_build_object('state', 'unknown');
  end if;
  committee := public.is_site_owner() or public.has_access('review_accounts');
  cards_live := coalesce((select enabled from public.site_switches where key = 'delegate_card'), true);

  if t.id = me.id then
    state := 'self';
  elsif not (me.account_status = 'approved' or committee) then
    state := 'not_member';
  elsif not (cards_live or committee) then
    state := 'cards_off';
  elsif t.account_status <> 'approved' then
    state := 'unknown';
  elsif not t.card_shared then
    state := 'hidden';
  else
    state := 'ok';
  end if;

  out := jsonb_build_object('state', state);
  if state in ('ok', 'self') then
    select * into s from public.saved_contacts where owner_id = me.id and contact_id = t.id;
    out := out || jsonb_build_object('card', public.card_json(t), 'saved', s.owner_id is not null, 'note', s.note, 'shared', t.card_shared);
  end if;
  if staff then
    out := out || jsonb_build_object('checkin', jsonb_build_object(
      'id', t.id,
      'full_name', t.full_name,
      'institution', t.institution,
      'roles', to_jsonb(public.all_types(t.account_type, t.extra_types))
    ) || public.attendance_json(t.id));
  end if;
  return out;
end $$;

create or replace function public.save_contact(code text, note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  res jsonb := public.card_lookup(code);
  target uuid;
begin
  if res ->> 'state' <> 'ok' then
    return jsonb_build_object('ok', false, 'state', res ->> 'state');
  end if;
  target := (res -> 'card' ->> 'id')::uuid;
  insert into public.saved_contacts (owner_id, contact_id, note)
  values (auth.uid(), target, left(nullif(trim(note), ''), 500))
  on conflict (owner_id, contact_id) do update set note = coalesce(excluded.note, public.saved_contacts.note);
  return jsonb_build_object('ok', true);
end $$;

-- Everyone I've saved, with what they share now. If someone has since
-- turned sharing off or left, only my own note and the date remain.
create or replace function public.my_contacts()
returns table (contact_id uuid, saved_at timestamptz, note text, shared boolean, card jsonb)
language sql stable security definer set search_path = public as $$
  select s.contact_id, s.saved_at, s.note,
         (p.card_shared and p.account_status = 'approved'),
         case when p.card_shared and p.account_status = 'approved' then public.card_json(p) end
    from public.saved_contacts s
    join public.profiles p on p.id = s.contact_id
   where s.owner_id = auth.uid()
   order by s.saved_at desc
$$;

-- ---------------------------------------------------------------------
-- Check-in on the day.
-- ---------------------------------------------------------------------
create or replace function public.check_in_person(target uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.profiles;
  ed uuid;
  reg public.registrations;
  result text;
begin
  if not public.can_check_in() then
    raise exception 'Not authorised';
  end if;
  select * into t from public.profiles where id = target;
  if t.id is null then
    return jsonb_build_object('result', 'unknown');
  end if;
  select id into ed from public.editions where is_current limit 1;
  if ed is null then
    result := 'no_event';
  elsif t.account_status <> 'approved' then
    result := 'not_approved';
  else
    select * into reg from public.registrations where edition_id = ed and user_id = t.id for update;
    if reg.id is null then
      insert into public.registrations (edition_id, user_id, status, source, checked_in_at, checked_in_by)
      values (ed, t.id, 'confirmed', 'manual', now(), auth.uid());
      result := 'checked_in';
    elsif reg.status <> 'confirmed' then
      result := 'registration_' || reg.status;
    elsif reg.checked_in_at is not null then
      result := 'already';
    else
      update public.registrations set checked_in_at = now(), checked_in_by = auth.uid() where id = reg.id;
      result := 'checked_in';
    end if;
  end if;
  return jsonb_build_object(
    'result', result,
    'person', jsonb_build_object('id', t.id, 'full_name', t.full_name, 'institution', t.institution,
                                 'roles', to_jsonb(public.all_types(t.account_type, t.extra_types))) || public.attendance_json(t.id)
  );
end $$;

create or replace function public.check_in_card(code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.can_check_in() then
    raise exception 'Not authorised';
  end if;
  select id into target from public.profiles where card_code = public.clean_card_code(code);
  if target is null then
    return jsonb_build_object('result', 'unknown');
  end if;
  return public.check_in_person(target);
end $$;

-- Older check-in codes (INSPIRE-CHECKIN:<registration token>) still work.
create or replace function public.check_in_ticket(token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not public.can_check_in() then
    raise exception 'Not authorised';
  end if;
  select user_id into target from public.registrations where checkin_token = token;
  if target is null then
    return jsonb_build_object('result', 'unknown');
  end if;
  return public.check_in_person(target);
end $$;

-- For a mistaken scan.
create or replace function public.undo_check_in(target uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.can_check_in() then
    raise exception 'Not authorised';
  end if;
  update public.registrations r set checked_in_at = null, checked_in_by = null
    from public.editions e
   where e.is_current and r.edition_id = e.id and r.user_id = target;
  return jsonb_build_object('result', 'undone', 'person', jsonb_build_object('id', target) || public.attendance_json(target));
end $$;

-- Find someone by name, university or email when they can't show their code.
-- Returns no email addresses.
create or replace function public.check_in_search(q text)
returns table (id uuid, full_name text, institution text, roles public.account_type[], checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.institution, public.all_types(p.account_type, p.extra_types), r.checked_in_at
    from public.profiles p
    left join public.editions e on e.is_current
    left join public.registrations r on r.user_id = p.id and r.edition_id = e.id
   where public.can_check_in()
     and char_length(trim(q)) >= 2
     and p.account_status = 'approved'
     and (p.full_name ilike '%' || trim(q) || '%' or p.institution ilike '%' || trim(q) || '%' or lower(p.email) = lower(trim(q)))
   order by lower(p.full_name)
   limit 25
$$;

create or replace function public.recent_check_ins()
returns table (id uuid, full_name text, checked_in_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, r.checked_in_at
    from public.registrations r
    join public.editions e on e.id = r.edition_id and e.is_current
    join public.profiles p on p.id = r.user_id
   where public.can_check_in() and r.checked_in_at is not null
   order by r.checked_in_at desc
   limit 8
$$;

-- Everyone with an approved account is expected, whether or not they have a
-- registration row yet.
create or replace function public.checkin_counts()
returns table (confirmed bigint, checked_in bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.profiles p where p.account_status = 'approved'),
         (select count(*) from public.registrations r join public.editions e on e.id = r.edition_id and e.is_current where r.checked_in_at is not null)
   where public.can_check_in()
$$;

revoke all on function public.new_my_card_code() from public, anon;
revoke all on function public.can_check_in() from public, anon;
revoke all on function public.attendance_json(uuid) from public, anon, authenticated;
revoke all on function public.card_lookup(text) from public, anon;
revoke all on function public.save_contact(text, text) from public, anon;
revoke all on function public.my_contacts() from public, anon;
revoke all on function public.check_in_person(uuid) from public, anon;
revoke all on function public.check_in_card(text) from public, anon;
revoke all on function public.check_in_ticket(uuid) from public, anon;
revoke all on function public.undo_check_in(uuid) from public, anon;
revoke all on function public.check_in_search(text) from public, anon;
revoke all on function public.recent_check_ins() from public, anon;
grant execute on function public.new_my_card_code() to authenticated;
grant execute on function public.can_check_in() to authenticated;
grant execute on function public.card_lookup(text) to authenticated;
grant execute on function public.save_contact(text, text) to authenticated;
grant execute on function public.my_contacts() to authenticated;
grant execute on function public.check_in_person(uuid) to authenticated;
grant execute on function public.check_in_card(text) to authenticated;
grant execute on function public.check_in_ticket(uuid) to authenticated;
grant execute on function public.undo_check_in(uuid) to authenticated;
grant execute on function public.check_in_search(text) to authenticated;
grant execute on function public.recent_check_ins() to authenticated;
