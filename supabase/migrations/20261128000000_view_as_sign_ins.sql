-- =====================================================================
-- "View as" no longer counts as the person signing in.
--
--   * Opening "View as" starts a real session for that account, and the
--     auth service records it as their latest sign-in. The website now
--     puts their own last sign-in time back straight afterwards, using
--     keep_last_sign_in below, which only the server's secret key can run.
--   * Sign-in times already changed by "View as" are repaired from the
--     auth service's own sign-in log: each affected account gets back
--     the time of the last sign-in that wasn't a "View as", or none if
--     they have never signed in themselves.
-- =====================================================================

create or replace function public.keep_last_sign_in(p_user uuid, p_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  update auth.users set last_sign_in_at = p_at where id = p_user;
$$;
revoke all on function public.keep_last_sign_in(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.keep_last_sign_in(uuid, timestamptz) to service_role;

-- One-off repair. A "View as" sign-in is the auth log's login for that
-- account within a minute after the site owner started viewing as them.
with views as (
  select entity_id::uuid as user_id, created_at
    from public.audit_events
   where action = 'view_as_start' and entity_id ~ '^[0-9a-f-]{36}$'
),
logins as (
  select (l.payload->>'actor_id')::uuid as user_id, l.created_at
    from auth.audit_log_entries l
   where l.payload->>'action' = 'login'
     and l.payload->>'actor_id' ~ '^[0-9a-f-]{36}$'
),
own as (
  select g.user_id, max(g.created_at) as at
    from logins g
   where not exists (
     select 1 from views v
      where v.user_id = g.user_id
        and g.created_at between v.created_at - interval '1 minute' and v.created_at + interval '1 minute'
   )
   group by g.user_id
),
touched as (
  -- Accounts whose current sign-in time came from a "View as".
  select u.id
    from auth.users u
   where u.last_sign_in_at is not null
     and exists (
       select 1 from views v
        where v.user_id = u.id
          and u.last_sign_in_at between v.created_at - interval '1 minute' and v.created_at + interval '1 minute'
     )
)
update auth.users u
   set last_sign_in_at = own.at
  from touched t
  left join own on own.user_id = t.id
 where u.id = t.id;
