-- People can hold more than one role: for example the vice president who
-- also leads the Academic Team, or a committee member who is presenting a
-- poster. account_type stays the main role (used for labels); extra_types
-- holds the others. Permissions and presenter features count every role.

alter table public.profiles add column if not exists extra_types public.account_type[] not null default '{}';
alter table public.delegate_roster add column if not exists extra_types public.account_type[] not null default '{}';

-- Every role someone holds, main role first.
create or replace function public.all_types(main public.account_type, extra public.account_type[])
returns public.account_type[] language sql immutable as $$
  select array[main] || coalesce(extra, '{}')
$$;

-- A permission is allowed if any of their roles allows it.
create or replace function public.has_access(cap text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when p.role = 'admin' then true
      when o.allowed is not null then o.allowed and p.account_status <> 'declined'
      when p.account_status <> 'approved' then
        (p.role = 'editor' and cap in ('edit_website', 'review_submissions'))
      else exists (
          select 1 from public.access_rules r
           where r.account_type = any(public.all_types(p.account_type, p.extra_types))
             and r.capability = cap and r.allowed
        )
        or (p.role = 'editor' and cap in ('edit_website', 'review_submissions'))
    end
    from public.profiles p
    left join public.access_overrides o on o.user_id = p.id and o.capability = cap
    where p.id = auth.uid()
  ), false)
$$;

-- Presenters can upload whichever presentations their roles cover.
create or replace function public.can_submit(k public.submission_kind)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select account_status = 'approved' and (
      (k = 'slides' and 'oral_presenter' = any(public.all_types(account_type, extra_types)))
      or (k = 'poster' and 'poster_presenter' = any(public.all_types(account_type, extra_types)))
    ) from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.can_confirm_attendance()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.account_status = 'approved'
       and public.all_types(p.account_type, p.extra_types) && array['oral_presenter', 'poster_presenter']::public.account_type[]
  )
$$;

-- Extra roles follow the same rules as the main one: only the executive
-- committee changes them, nobody changes their own, and only the president
-- or vice president adds or removes executive roles.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  exec_types constant public.account_type[] := array['executive_committee', 'vice_president', 'president'];
begin
  if auth.uid() is null or current_setting('inspire.roster_apply', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_site_owner() then
    raise exception 'Only the site owner can change site roles';
  end if;
  if (new.account_type is distinct from old.account_type
      or new.extra_types is distinct from old.extra_types
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
    if (public.all_types(new.account_type, new.extra_types) && exec_types
        or public.all_types(old.account_type, old.extra_types) && exec_types)
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

create or replace function public.guard_roster_type()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  exec_types constant public.account_type[] := array['executive_committee', 'vice_president', 'president'];
begin
  if auth.uid() is null then
    return new;
  end if;
  if ((tg_op = 'INSERT' and public.all_types(new.account_type, new.extra_types) && exec_types)
      or (tg_op = 'UPDATE'
          and public.all_types(new.account_type, new.extra_types) is distinct from public.all_types(old.account_type, old.extra_types)
          and (public.all_types(new.account_type, new.extra_types) && exec_types
               or public.all_types(old.account_type, old.extra_types) && exec_types)))
     and not public.is_leadership() then
    raise exception 'Only the president or vice president can put someone in the executive committee';
  end if;
  return new;
end $$;

-- Group emails reach everyone who holds any of the chosen roles.
drop function if exists public.broadcast_recipients(public.account_type[], public.account_status[], boolean);
create function public.broadcast_recipients(types public.account_type[], statuses public.account_status[], marketing_only boolean)
returns table (email text, full_name text, account_type public.account_type, account_status public.account_status, institution text, id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_access('send_email') then
    raise exception 'Not authorised';
  end if;
  return query
    select lower(p.email), p.full_name, p.account_type, p.account_status, p.institution, p.id from public.profiles p
    where public.all_types(p.account_type, p.extra_types) && types and p.account_status = any(statuses)
      and p.email is not null and (not marketing_only or p.marketing_opt_in)
    order by lower(coalesce(p.full_name, p.email))
    limit 5000;
end $$;
revoke all on function public.broadcast_recipients(public.account_type[], public.account_status[], boolean) from public, anon;
grant execute on function public.broadcast_recipients(public.account_type[], public.account_status[], boolean) to authenticated;

drop function if exists public.selected_recipients(public.account_type[]);
create function public.selected_recipients(types public.account_type[])
returns table (email text, full_name text, account_type public.account_type, institution text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_access('send_email') then
    raise exception 'Not authorised';
  end if;
  return query
    select r.email, r.full_name, r.account_type, r.institution from public.delegate_roster r
     where public.all_types(r.account_type, r.extra_types) && types
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
     order by lower(r.full_name)
     limit 5000;
end $$;
revoke all on function public.selected_recipients(public.account_type[]) from public, anon;
grant execute on function public.selected_recipients(public.account_type[]) to authenticated;

-- Audience sizes count someone once under each role they hold.
create or replace function public.audience_counts()
returns table (account_type public.account_type, account_status public.account_status, total bigint, marketing bigint)
language sql stable security definer set search_path = public as $$
  select t, p.account_status, count(*), count(*) filter (where p.marketing_opt_in)
  from public.profiles p, unnest(public.all_types(p.account_type, p.extra_types)) t
  where public.has_access('send_email') or public.has_access('review_accounts')
  group by 1, 2
$$;

-- New accounts from the selected list get every role on their entry.
create or replace function public.copy_roster_extras()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p set extra_types = r.extra_types
    from public.delegate_roster r
   where p.id = new.id and r.email = lower(new.email) and cardinality(r.extra_types) > 0;
  return new;
end $$;
drop trigger if exists profiles_copy_roster_extras on public.profiles;
create trigger profiles_copy_roster_extras after insert on public.profiles
  for each row execute function public.copy_roster_extras();

-- Adding someone to the list after they registered carries their extra roles too.
create or replace function public.apply_roster_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('inspire.roster_apply', 'on', true);
  update public.profiles p
     set account_status = 'approved',
         account_type = case when p.account_type in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist') then new.account_type else p.account_type end,
         extra_types = case when p.account_type in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist') then new.extra_types else p.extra_types end,
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

-- Sign-in activity shows and filters by every role.
drop function if exists public.owner_activity();
create function public.owner_activity()
returns table (
  id uuid, email text, full_name text, institution text, account_type public.account_type,
  account_status public.account_status, joined_at timestamptz, last_sign_in_at timestamptz,
  last_seen_at timestamptz, ever_signed_in boolean, extra_types public.account_type[]
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_site_owner() then
    raise exception 'Only the site owner can see activity';
  end if;
  return query
    select p.id, p.email, p.full_name, p.institution, p.account_type, p.account_status,
           p.created_at, u.last_sign_in_at,
           greatest(a.last_seen_at, u.last_sign_in_at),
           u.last_sign_in_at is not null,
           p.extra_types
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.user_activity a on a.user_id = p.id;
end $$;
revoke all on function public.owner_activity() from public, anon;
grant execute on function public.owner_activity() to authenticated;
