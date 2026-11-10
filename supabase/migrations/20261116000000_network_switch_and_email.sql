-- =====================================================================
-- 1. A switch for the delegate network. While it is off, only the site
--    owner can see it, so it can be prepared before delegates arrive.
-- 2. Group emails can include selected delegates who haven't set up an
--    account yet (conference updates only, never news or promotion).
-- 3. Emails to one person, logged like group emails.
-- =====================================================================

create table if not exists public.site_switches (
  key text primary key,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_switches enable row level security;
drop policy if exists "switches: anyone reads" on public.site_switches;
drop policy if exists "switches: owner writes" on public.site_switches;
create policy "switches: anyone reads" on public.site_switches for select using (true);
create policy "switches: owner writes" on public.site_switches for all using (public.is_site_owner()) with check (public.is_site_owner());
insert into public.site_switches (key, enabled) values ('network_open', false) on conflict do nothing;

create or replace function public.network_is_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.site_switches where key = 'network_open'), false)
$$;

-- Same as before, but returns nothing to anyone except the site owner while
-- the network is switched off.
drop function if exists public.network_directory();
create function public.network_directory()
returns table (
  id text, full_name text, institution text, year_of_study text, account_type public.account_type,
  committee_position text, bio text, linkedin_url text, email text, joined boolean
)
language sql stable security definer set search_path = public as $$
  with me as (
    select (p.account_status = 'approved' or p.role = 'admin') as member,
           public.has_access('review_accounts') as staff
      from public.profiles p
     where p.id = auth.uid() and (public.network_is_open() or public.is_site_owner())
  ), people as (
    select p.id::text, p.full_name, p.institution, p.year_of_study, p.account_type,
           case when p.account_type in ('supporting_committee', 'executive_committee', 'vice_president', 'president') then p.committee_position end,
           p.bio, p.linkedin_url,
           case when p.network_show_email then p.email end,
           true
      from public.profiles p, me
     where (me.member or me.staff)
       and p.network_listed and p.account_status = 'approved' and p.full_name is not null
    union all
    select 'selected:' || md5(r.email), r.full_name, r.institution, r.year_of_study, r.account_type,
           null, null, null, null, false
      from public.delegate_roster r, me
     where me.staff
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
  )
  select * from people order by lower(full_name)
$$;
revoke all on function public.network_directory() from public, anon;
grant execute on function public.network_directory() to authenticated;

-- ---------------------------------------------------------------------
-- Email
-- ---------------------------------------------------------------------
alter table public.email_broadcasts
  add column if not exists include_selected boolean not null default false,
  add column if not exists recipient_email text check (char_length(recipient_email) <= 320);

-- Selected delegates who haven't set up an account, in the chosen groups.
create or replace function public.selected_recipients(types public.account_type[])
returns table (email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_access('send_email') then
    raise exception 'Not authorised';
  end if;
  return query
    select r.email, r.full_name from public.delegate_roster r
     where r.account_type = any(types)
       and not exists (select 1 from public.profiles p where lower(p.email) = r.email)
     limit 5000;
end $$;
revoke all on function public.selected_recipients(public.account_type[]) from public, anon;
grant execute on function public.selected_recipients(public.account_type[]) to authenticated;

-- Everyone the committee can email individually: accounts and the selected list.
create or replace function public.email_directory()
returns table (email text, full_name text, detail text, joined boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_access('send_email') then
    raise exception 'Not authorised';
  end if;
  return query
    select lower(p.email), p.full_name, concat_ws(' · ', p.institution, initcap(replace(p.account_type::text, '_', ' '))), true
      from public.profiles p where p.email is not null
    union all
    select r.email, r.full_name, concat_ws(' · ', r.institution, 'Not joined yet'), false
      from public.delegate_roster r
     where not exists (select 1 from public.profiles p where lower(p.email) = r.email)
    order by 2;
end $$;
revoke all on function public.email_directory() from public, anon;
grant execute on function public.email_directory() to authenticated;
