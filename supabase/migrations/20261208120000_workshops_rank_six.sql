-- =====================================================================
-- Workshops: rank all six, go to three.
--
--   * All six workshops now run at the same time, in each of the three
--     workshop sessions. Each delegate goes to three different workshops,
--     one per session.
--   * Delegates rank all six from 1 to 6. The allocation gives each person
--     as many of their top three as the rooms allow, and decides which
--     session they do each one in.
--   * Each workshop has its own room. The room size is how many people it
--     holds in one session.
--   * The committee can move anyone by hand: change their workshop in a
--     session, swap two of their sessions, or place someone who missed the
--     allocation.
--
-- Run after 29-workshop-choices.sql. Safe to run more than once.
-- =====================================================================

-- The room each workshop runs in.
alter table public.workshops add column if not exists room text;

-- Workshops no longer pair up into A and B, so clear the old pairing.
update public.workshops set slot = null, stream = null where slot is not null or stream is not null;

-- Nobody goes to the same workshop twice. Checked at the end of each
-- change, so two sessions can be swapped in one go.
alter table public.workshop_allocations drop constraint if exists workshop_allocations_once_each;
alter table public.workshop_allocations add constraint workshop_allocations_once_each
  unique (edition_id, user_id, workshop_id) deferrable initially deferred;

update public.access_capabilities
   set description = 'Open and close workshop ranking, set rooms and room sizes, run the allocation, move people and publish places.'
 where key = 'allocate_workshops';

-- The committee sets each workshop's room and room size.
-- p: [{"id": "...", "room": "LMS0005", "capacity": 40}, ...]
create or replace function public.workshop_rooms_save(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id(); r jsonb;
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  for r in select * from jsonb_array_elements(p) loop
    update public.workshops
       set room = nullif(btrim(r->>'room'), ''),
           capacity = nullif(r->>'capacity', '')::int
     where id = (r->>'id')::uuid and edition_id = ed;
  end loop;
end $$;

-- The committee saves a new allocation, replacing the last one.
-- p_rows: [{"user_id": "...", "slot": 1, "workshop_id": "...", "choice": 2}, ...]
create or replace function public.workshop_allocation_replace(p_rows jsonb, p_summary jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare ed uuid := public.current_edition_id(); run uuid;
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  delete from public.workshop_allocations where edition_id = ed;
  insert into public.workshop_allocations (edition_id, user_id, slot, workshop_id, choice)
  select ed, (x->>'user_id')::uuid, (x->>'slot')::smallint, (x->>'workshop_id')::uuid, nullif(x->>'choice', '')::smallint
    from jsonb_array_elements(p_rows) x
    join public.workshops w on w.id = (x->>'workshop_id')::uuid and w.edition_id = ed;
  insert into public.workshop_allocation_runs (edition_id, ran_by, summary) values (ed, auth.uid(), coalesce(p_summary, '{}'))
  returning id into run;
  return run;
end $$;

-- The committee puts one person in a workshop for one session. If they're
-- already doing that workshop in another session, the two sessions swap.
-- p_workshop null takes them out of that session.
create or replace function public.workshop_allocation_set(p_user uuid, p_slot int, p_workshop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  ed uuid := public.current_edition_id();
  rk uuid[];
  cur uuid;
  other_slot smallint;
begin
  if not public.has_access('allocate_workshops') then raise exception 'NOT_ALLOWED'; end if;
  if p_slot not between 1 and 3 then raise exception 'BAD_SESSION'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'NO_PERSON'; end if;
  if p_workshop is not null and not exists (select 1 from public.workshops where id = p_workshop and edition_id = ed) then
    raise exception 'NO_WORKSHOP';
  end if;
  select ranking into rk from public.workshop_rankings where user_id = p_user and edition_id = ed;
  select workshop_id into cur from public.workshop_allocations where edition_id = ed and user_id = p_user and slot = p_slot;

  if p_workshop is null then
    delete from public.workshop_allocations where edition_id = ed and user_id = p_user and slot = p_slot;
    return;
  end if;
  if cur = p_workshop then return; end if;

  select slot into other_slot from public.workshop_allocations
   where edition_id = ed and user_id = p_user and workshop_id = p_workshop and slot <> p_slot;
  if other_slot is not null then
    if cur is null then
      delete from public.workshop_allocations where edition_id = ed and user_id = p_user and slot = other_slot;
    else
      update public.workshop_allocations set workshop_id = cur, choice = array_position(rk, cur), manual = true
       where edition_id = ed and user_id = p_user and slot = other_slot;
    end if;
  end if;

  insert into public.workshop_allocations (edition_id, user_id, slot, workshop_id, choice, manual)
  values (ed, p_user, p_slot, p_workshop, array_position(rk, p_workshop), true)
  on conflict (edition_id, user_id, slot) do update
    set workshop_id = excluded.workshop_id, choice = excluded.choice, manual = true;
end $$;

revoke all on function public.workshop_rooms_save(jsonb) from public, anon;
revoke all on function public.workshop_allocation_replace(jsonb, jsonb) from public, anon;
revoke all on function public.workshop_allocation_set(uuid, int, uuid) from public, anon;
grant execute on function public.workshop_rooms_save(jsonb) to authenticated;
grant execute on function public.workshop_allocation_replace(jsonb, jsonb) to authenticated;
grant execute on function public.workshop_allocation_set(uuid, int, uuid) to authenticated;

notify pgrst, 'reload schema';
