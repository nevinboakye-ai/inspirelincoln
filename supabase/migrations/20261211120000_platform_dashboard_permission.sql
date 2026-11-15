-- =====================================================================
-- The platform dashboard becomes a permission of its own.
--
-- Until now only the site owner could open the platform dashboard (site
-- switches, who can do what, individual access, sign-in activity and
-- website metrics). This adds a "Platform dashboard" permission
-- (manage_platform) that is on for the president and off for everyone
-- else. The site owner can give it to, or take it from, any account type
-- or any one person on the dashboard, like every other permission.
--
-- Still for the site owner only: site roles (who is a site owner),
-- "View as", changing someone's login email, and a site owner's own
-- account, which nobody else can change.
--
-- Needs setup file 41. Safe to run more than once.
-- =====================================================================

insert into public.access_capabilities (key, label, description, sort) values
  ('manage_platform', 'Platform dashboard', 'Site switches, who can do what, individual access, sign-in activity and website metrics.', 60)
on conflict (key) do update set label = excluded.label, description = excluded.description, sort = excluded.sort;

insert into public.access_rules (account_type, capability, allowed)
select t.account_type, 'manage_platform', t.account_type::text = 'president'
  from (select unnest(enum_range(null::public.account_type)) as account_type) t
on conflict (account_type, capability) do nothing;

-- The site owner, or anyone with the permission. has_access() is always true for a site owner.
create or replace function public.can_manage_platform()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_access('manage_platform')
$$;
revoke all on function public.can_manage_platform() from public, anon;
grant execute on function public.can_manage_platform() to authenticated;

-- Who can do what, and individual access.
drop policy if exists "access rules: owner" on public.access_rules;
create policy "access rules: owner" on public.access_rules for all
  using (public.can_manage_platform()) with check (public.can_manage_platform());

drop policy if exists "access overrides: owner or self read" on public.access_overrides;
drop policy if exists "access overrides: owner write" on public.access_overrides;
create policy "access overrides: owner or self read" on public.access_overrides for select
  using (public.can_manage_platform() or user_id = auth.uid());
create policy "access overrides: owner write" on public.access_overrides for all
  using (public.can_manage_platform() and user_id <> auth.uid() and not exists (select 1 from public.profiles p where p.id = user_id and p.role = 'admin'))
  with check (public.can_manage_platform() and user_id <> auth.uid() and not exists (select 1 from public.profiles p where p.id = user_id and p.role = 'admin'));

-- Site switches.
drop policy if exists "switches: owner writes" on public.site_switches;
create policy "switches: owner writes" on public.site_switches for all
  using (public.can_manage_platform()) with check (public.can_manage_platform());

-- Sign-in activity (as in the extra roles setup, with the new check).
drop function if exists public.owner_activity();
create function public.owner_activity()
returns table (
  id uuid, email text, full_name text, institution text, account_type public.account_type,
  account_status public.account_status, joined_at timestamptz, last_sign_in_at timestamptz,
  last_seen_at timestamptz, ever_signed_in boolean, extra_types public.account_type[]
)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.can_manage_platform() then
    raise exception 'Only the platform dashboard can show activity';
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

-- Website metrics (as before, with the new check).
create or replace function public.owner_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 400));
  since timestamptz := date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London' - make_interval(days => d - 1);
  prev timestamptz := since - make_interval(days => d);
  out jsonb;
begin
  if not public.can_manage_platform() then
    raise exception 'Only the platform dashboard can show metrics';
  end if;
  with v as (
    select *, (at at time zone 'Europe/London')::date as day from public.page_views where at >= prev
  ), cur as (select * from v where at >= since), old as (select * from v where at < since),
  -- A visit: one visitor's views on one day.
  visits as (select day, visitor, count(*) n from cur group by day, visitor)
  select jsonb_build_object(
    'days', d,
    'views', (select count(*) from cur),
    'visitors', (select count(*) from visits),
    'single_page', (select count(*) from visits where n = 1),
    'signed_in_views', (select count(*) from cur where signed_in),
    'prev_views', (select count(*) from old),
    'prev_visitors', (select count(*) from (select distinct day, visitor from old) x),
    'live', (select count(distinct visitor) from public.page_views where at > now() - interval '30 minutes'),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', g.day, 'views', coalesce(c.views, 0), 'visitors', coalesce(c.visitors, 0)) order by g.day)
        from (select generate_series((since at time zone 'Europe/London')::date, (now() at time zone 'Europe/London')::date, interval '1 day')::date as day) g
        left join (select day, count(*) views, count(distinct visitor) visitors from cur group by day) c on c.day = g.day
    ), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'views', n) order by h)
        from (select extract(hour from at at time zone 'Europe/London')::int h, count(*) n from cur group by 1) x
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(x order by x.views desc) from (
        select path, count(*) views, count(distinct (day, visitor)) visitors from cur group by path order by count(*) desc limit 15
      ) x
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(x order by x.visitors desc) from (
        select coalesce(referrer, 'Direct or unknown') source, count(distinct (day, visitor)) visitors from cur group by 1 order by 2 desc limit 10
      ) x
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(x order by x.visitors desc) from (select device, count(distinct (day, visitor)) visitors from cur group by device) x
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(x order by x.visitors desc) from (
        select coalesce(country, '--') country, count(distinct (day, visitor)) visitors from cur group by 1 order by 2 desc limit 8
      ) x
    ), '[]'::jsonb),
    'accounts', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'approved', (select count(*) from public.profiles where account_status = 'approved'),
      'new', (select count(*) from public.profiles where created_at >= since),
      'ever_signed_in', (select count(*) from auth.users u join public.profiles p on p.id = u.id where u.last_sign_in_at is not null),
      'active_day', (select count(*) from public.user_activity where last_seen_at > now() - interval '24 hours'),
      'active_week', (select count(*) from public.user_activity where last_seen_at > now() - interval '7 days'),
      'signups', coalesce((
        select jsonb_agg(jsonb_build_object('day', g.day, 'n', coalesce(c.n, 0)) order by g.day)
          from (select generate_series((since at time zone 'Europe/London')::date, (now() at time zone 'Europe/London')::date, interval '1 day')::date as day) g
          left join (select (created_at at time zone 'Europe/London')::date as day, count(*) n from public.profiles where created_at >= since group by 1) c on c.day = g.day
      ), '[]'::jsonb)
    )
  ) into out;
  return out;
end $$;
revoke all on function public.owner_metrics(integer) from public, anon;
grant execute on function public.owner_metrics(integer) to authenticated;
