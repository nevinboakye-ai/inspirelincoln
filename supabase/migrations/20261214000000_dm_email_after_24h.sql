-- Message emails wait 24 hours.
--
-- Before: sending a direct message emailed the other person straight away
-- (unless they'd been on the website in the last ten minutes).
-- Now: nothing is emailed when a message is sent. A scheduled job calls
-- dm_due_emails() every so often. It finds conversations where someone still
-- hasn't opened a message 24 hours after it was sent, marks each one as
-- emailed, and returns them so the server can send one email per person
-- covering all of their unread conversations.
--
-- Each unread stretch in a conversation is emailed about at most once: after
-- an email, that conversation isn't emailed about again until they've opened
-- it. Messages more than 7 days old are ignored, so turning this on can't
-- send a burst of emails about old messages.
--
-- Enquiries are separate and are still emailed straight away.

-- One row: when the job last ran, so busy page loads can share one run.
create table if not exists public.dm_email_sweep (
  id boolean primary key default true check (id),
  last_run_at timestamptz not null default '-infinity'
);
insert into public.dm_email_sweep (id) values (true) on conflict (id) do nothing;
alter table public.dm_email_sweep enable row level security;

create index if not exists dm_members_notify_idx on public.dm_members (user_id) include (last_read_at, cleared_at, notified_at);

create or replace function public.dm_due_emails(p_after interval default interval '24 hours', p_gap interval default null)
returns table (user_id uuid, email text, full_name text, conversation_id uuid, sender_name text, unread int)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  -- With a gap, only one caller in each gap gets to run.
  if p_gap is not null then
    update public.dm_email_sweep s set last_run_at = now() where s.id and s.last_run_at < now() - p_gap;
    if not found then return; end if;
  end if;

  return query
  with due as (
    select m.conversation_id, m.user_id, greatest(coalesce(m.last_read_at, '-infinity'), coalesce(m.cleared_at, '-infinity')) as seen
    from public.dm_members m
    join public.profiles p on p.id = m.user_id
    where p.dm_email and nullif(btrim(p.email), '') is not null
      -- Not already emailed about this unread stretch.
      and (m.notified_at is null or m.notified_at <= greatest(coalesce(m.last_read_at, '-infinity'), coalesce(m.cleared_at, '-infinity')))
      and exists (
        select 1 from public.dm_messages x
        where x.conversation_id = m.conversation_id
          and x.sender_id is distinct from m.user_id
          and x.created_at > greatest(coalesce(m.last_read_at, '-infinity'), coalesce(m.cleared_at, '-infinity'))
          and x.created_at <= now() - p_after
          and x.created_at > now() - interval '7 days'
      )
    order by m.user_id
    limit 2000
    for update of m skip locked
  ),
  marked as (
    update public.dm_members m set notified_at = now()
    from due d
    where m.conversation_id = d.conversation_id and m.user_id = d.user_id
    returning m.conversation_id, m.user_id, d.seen
  )
  select k.user_id, p.email, p.full_name, k.conversation_id,
         coalesce((select x.sender_name from public.dm_messages x
                   where x.conversation_id = k.conversation_id and x.sender_id is distinct from k.user_id and x.created_at > k.seen
                   order by x.created_at desc limit 1), 'Someone'),
         (select count(*)::int from public.dm_messages x
          where x.conversation_id = k.conversation_id and x.sender_id is distinct from k.user_id and x.created_at > k.seen)
  from marked k
  join public.profiles p on p.id = k.user_id
  order by k.user_id;
end;
$$;

-- Only the server (with the secret key) can run it: it returns email addresses.
revoke all on function public.dm_due_emails(interval, interval) from public, anon, authenticated;
grant execute on function public.dm_due_emails(interval, interval) to service_role;

-- The old "email straight away" check is no longer used.
drop function if exists public.dm_notify_target(uuid);
