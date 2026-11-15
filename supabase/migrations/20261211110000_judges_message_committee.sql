-- =====================================================================
-- Judges: committee-only messages, and parking without a travel question.
--
--   * A judge (someone whose only roles are judge or speaker, with judge
--     among them) can message the committee and nobody else. They see the
--     committee in "New message" even before the delegate network opens,
--     because they may need the committee on the day.
--   * Delegates can't start a conversation with a judge, or reply to one.
--     The committee can still message judges, as before.
--   * Judges aren't asked how they're travelling. If they drive, they give
--     a car registration, and they can take it away again, so people can
--     now remove their own travel answer.
--
-- Needs setup files 43 to 46. Safe to run more than once.
-- =====================================================================

-- Whether someone is only here to judge: judge among their roles, and
-- nothing besides judge or speaker. Matches isJudgeOnly() in the website.
create or replace function public.is_judge_only(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select 'judge' = any (r) and r <@ array['judge', 'speaker']::public.account_type[]
      from (select public.all_types(p.account_type, p.extra_types) r from public.profiles p where p.id = p_id) x
  ), false)
$$;

-- Whether someone is on the committee: an approved committee role, or the site owner.
create or replace function public.is_committee_profile(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.role = 'admin' or (p.account_status = 'approved' and exists (
             select 1 from unnest(public.all_types(p.account_type, p.extra_types)) r
              where r::text not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist', 'speaker', 'judge')))
      from public.profiles p where p.id = p_id
  ), false)
$$;

-- As in setup file 43, with the judge rules added. Codes: not_found, self,
-- blocked, not_approved, off, closed, committee_only.
create or replace function public.dm_can_message(p_other uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  me public.profiles;
  them public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into them from public.profiles where id = p_other;
  if me.id is null or them.id is null then return 'not_found'; end if;
  if me.id = them.id then return 'self'; end if;
  if public.has_access('message_people') then return null; end if;
  if public.dm_blocked(me.id, them.id) then return 'blocked'; end if;
  -- Judges talk to the committee only, and only the committee talks to judges.
  if public.is_judge_only(me.id) then
    if not public.is_committee_profile(them.id) then return 'committee_only'; end if;
    if me.account_status <> 'approved' and me.role <> 'admin' then return 'not_approved'; end if;
    return null;
  end if;
  if public.is_judge_only(them.id) and not public.is_committee_profile(me.id) then return 'closed'; end if;
  -- They've already written to me: I can always reply.
  if exists (
    select 1 from public.dm_conversations c join public.dm_messages m on m.conversation_id = c.id
     where c.pair_key = public.dm_pair(me.id, them.id) and m.sender_id = them.id
  ) then return null; end if;
  if me.account_status <> 'approved' and me.role <> 'admin' then return 'not_approved'; end if;
  if not public.network_is_open()
     or not coalesce((select enabled from public.site_switches where key = 'delegate_messages'), true) then
    return 'off';
  end if;
  if them.account_status <> 'approved' or not them.network_listed or not them.dm_open then return 'closed'; end if;
  return null;
end;
$$;

create or replace function public.dm_reason_text(code text, who text)
returns text language sql immutable as $$
  select case code
    when 'self' then 'You can''t message yourself.'
    when 'blocked' then 'You can''t message ' || who || '.'
    when 'not_approved' then 'You can message other delegates once the committee confirms your place.'
    when 'off' then 'Messages between delegates aren''t open just now.'
    when 'closed' then who || ' isn''t taking messages from other delegates.'
    when 'committee_only' then 'As a judge, you can message the committee only.'
    else 'That person isn''t available.'
  end
$$;

-- As in setup file 43. Judges see the committee, whether or not the
-- delegate network is open; delegates no longer see judges.
create or replace function public.dm_contacts()
returns table (id uuid, full_name text, institution text, year_of_study text, roles public.account_type[],
               committee_position text, avatar_path text, account_status public.account_status)
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where profiles.id = auth.uid();
  if me.id is null then return; end if;
  if public.has_access('message_people') then
    return query
      select p.id, p.full_name, p.institution, p.year_of_study, public.all_types(p.account_type, p.extra_types),
             p.committee_position, p.avatar_path, p.account_status
        from public.profiles p
       where p.id <> me.id and nullif(btrim(p.full_name), '') is not null
       order by lower(p.full_name)
       limit 3000;
    return;
  end if;
  if public.is_judge_only(me.id) then
    if me.account_status <> 'approved' and me.role <> 'admin' then return; end if;
    return query
      select p.id, p.full_name, p.institution, p.year_of_study, public.visible_types(p.id, public.all_types(p.account_type, p.extra_types)),
             p.committee_position, p.avatar_path, p.account_status
        from public.profiles p
       where p.id <> me.id and public.is_committee_profile(p.id)
         and nullif(btrim(p.full_name), '') is not null
         and not public.dm_blocked(me.id, p.id)
       order by lower(p.full_name)
       limit 3000;
    return;
  end if;
  if (me.account_status <> 'approved' and me.role <> 'admin') or not public.network_is_open()
     or not coalesce((select enabled from public.site_switches where key = 'delegate_messages'), true) then
    return;
  end if;
  return query
    select p.id, p.full_name, p.institution, p.year_of_study, public.visible_types(p.id, public.all_types(p.account_type, p.extra_types)),
           case when exists (
               select 1 from unnest(public.all_types(p.account_type, p.extra_types)) r
                where r not in ('delegate', 'oral_presenter', 'poster_presenter', 'oral_waitlist')
             ) then p.committee_position end,
           p.avatar_path, p.account_status
      from public.profiles p
     where p.id <> me.id and p.account_status = 'approved' and p.network_listed and p.dm_open
       and nullif(btrim(p.full_name), '') is not null
       and not public.dm_blocked(me.id, p.id)
       and not public.is_judge_only(p.id)
     order by lower(p.full_name)
     limit 3000;
end;
$$;

-- Removing your own travel answer (a judge who's no longer driving).
drop policy if exists "travel: remove own" on public.delegate_travel;
create policy "travel: remove own" on public.delegate_travel
  for delete using (user_id = auth.uid());
grant delete on public.delegate_travel to authenticated;

revoke all on function public.is_judge_only(uuid) from public, anon;
revoke all on function public.is_committee_profile(uuid) from public, anon;
grant execute on function public.is_judge_only(uuid) to authenticated;
grant execute on function public.is_committee_profile(uuid) to authenticated;
