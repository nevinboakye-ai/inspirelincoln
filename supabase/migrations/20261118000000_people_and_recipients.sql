-- =====================================================================
-- Person pages and the group email recipient list.
--
--   * broadcast_recipients and selected_recipients also return each
--     person's account type, status and university, so the committee
--     can see exactly who a group email will go to before sending.
--   * Each person on the selected list gets an id, so they have their own page.
--   * change_account_email lets the site owner correct someone's login
--     email. It changes the address they log in with and the one on
--     their profile together, so the two never drift apart.
-- =====================================================================

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
    where p.account_type = any(types) and p.account_status = any(statuses)
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
     where r.account_type = any(types)
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
     order by lower(r.full_name)
     limit 5000;
end $$;
revoke all on function public.selected_recipients(public.account_type[]) from public, anon;
grant execute on function public.selected_recipients(public.account_type[]) to authenticated;

-- Only the site owner can change the email someone logs in with.
create or replace function public.change_account_email(target uuid, new_email text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  e text := lower(trim(new_email));
begin
  if not public.is_site_owner() then
    raise exception 'Only the site owner can change login emails';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Invalid email';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = e and u.id <> target) then
    raise exception 'Email already in use';
  end if;
  update auth.users set email = e, updated_at = now() where id = target;
  if not found then
    raise exception 'Account not found';
  end if;
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(e)), updated_at = now()
   where user_id = target and provider = 'email';
  update public.profiles set email = e where id = target;
end $$;
revoke all on function public.change_account_email(uuid, text) from public, anon;
grant execute on function public.change_account_email(uuid, text) to authenticated;

-- A stable id for each person on the selected list, so each one has their
-- own page without putting their email address in the link.
alter table public.delegate_roster add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists delegate_roster_id_key on public.delegate_roster (id);
