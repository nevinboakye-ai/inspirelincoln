-- Activity and website metrics, for the site owner only.
--
-- 1. user_activity: when each signed-in person last used the website. Updated
--    at most every five minutes while they browse their account pages.
-- 2. page_views: privacy-friendly visit counting. No cookies and nothing stored
--    on the visitor's device. A visitor is a one-way hash of their connection
--    and browser with a random salt that changes every day and is then thrown
--    away, so the same person can't be recognised across days or identified.
--    Raw IP addresses are never stored. Views older than 13 months are deleted.

/* ---------- 1. Last active ---------- */
create table if not exists public.user_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.user_activity enable row level security;
-- No policies: read and written only through the functions below.

create or replace function public.touch_last_seen()
returns void language sql volatile security definer set search_path = public as $$
  insert into public.user_activity (user_id, last_seen_at)
  select auth.uid(), now()
   where auth.uid() is not null
     and exists (select 1 from public.profiles where id = auth.uid())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at
   where public.user_activity.last_seen_at < now() - interval '5 minutes'
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Everyone's sign-in history, for the site owner.
create or replace function public.owner_activity()
returns table (
  id uuid, email text, full_name text, institution text, account_type public.account_type,
  account_status public.account_status, joined_at timestamptz, last_sign_in_at timestamptz,
  last_seen_at timestamptz, ever_signed_in boolean
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
           u.last_sign_in_at is not null
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.user_activity a on a.user_id = p.id;
end $$;
revoke all on function public.owner_activity() from public, anon;
grant execute on function public.owner_activity() to authenticated;

/* ---------- 2. Page views ---------- */
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  path text not null check (char_length(path) <= 300),
  referrer text check (char_length(referrer) <= 200),
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  country text check (char_length(country) <= 2),
  visitor text not null,
  signed_in boolean not null default false
);
create index if not exists page_views_at_idx on public.page_views (at);
alter table public.page_views enable row level security;

create table if not exists public.analytics_salts (
  day date primary key,
  salt text not null
);
alter table public.analytics_salts enable row level security;

create or replace function public.record_page_view(
  p_path text, p_referrer text, p_device text, p_country text, p_ident text, p_signed_in boolean default false
)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/London')::date;
  s text;
begin
  if p_path is null or p_path !~ '^/' or char_length(p_path) > 300 then
    return;
  end if;
  select salt into s from public.analytics_salts where day = today;
  if s is null then
    insert into public.analytics_salts (day, salt) values (today, gen_random_uuid()::text || gen_random_uuid()::text)
      on conflict (day) do nothing;
    select salt into s from public.analytics_salts where day = today;
    -- Once a day: forget old salts and drop views older than 13 months.
    delete from public.analytics_salts where day < today;
    delete from public.page_views where at < now() - interval '13 months';
  end if;
  insert into public.page_views (path, referrer, device, country, visitor, signed_in)
  values (
    p_path,
    nullif(left(lower(p_referrer), 200), ''),
    case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end,
    case when p_country ~ '^[A-Z]{2}$' then p_country else null end,
    encode(sha256(convert_to(s || '|' || coalesce(p_ident, ''), 'UTF8')), 'hex'),
    coalesce(p_signed_in, false)
  );
end $$;
revoke all on function public.record_page_view(text, text, text, text, text, boolean) from public;
grant execute on function public.record_page_view(text, text, text, text, text, boolean) to anon, authenticated;

-- Everything the metrics page shows, for the site owner. Days are UK days.
create or replace function public.owner_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 400));
  since timestamptz := date_trunc('day', now() at time zone 'Europe/London') at time zone 'Europe/London' - make_interval(days => d - 1);
  prev timestamptz := since - make_interval(days => d);
  out jsonb;
begin
  if not public.is_site_owner() then
    raise exception 'Only the site owner can see metrics';
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
