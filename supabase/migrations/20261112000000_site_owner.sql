-- Site owner: the person who runs the website sits above the president.
-- A site owner is anyone with profiles.role = 'admin'. Only a site owner can
-- change site roles, and nobody else can change a site owner's account.

create or replace function public.is_site_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
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

-- review_account() updates profiles too, so this trigger covers it: auth.uid() is still the caller.
