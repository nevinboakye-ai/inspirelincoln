-- =====================================================================
-- Everyone on the oral waiting list also presents a poster.
--
--   * Whenever someone holds the oral waiting list role, on their account
--     or on the selected list, they also get the poster presenter role.
--     That lets them upload a poster, confirm attendance as a presenter,
--     and receive poster presenter emails.
--   * Anyone already on the waiting list gets the poster role now.
--   * If they're later offered an oral slot, they keep the poster role
--     unless someone removes it.
-- =====================================================================

create or replace function public.waitlist_presents_poster()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if 'oral_waitlist' = any(public.all_types(new.account_type, new.extra_types))
     and not 'poster_presenter' = any(public.all_types(new.account_type, new.extra_types)) then
    new.extra_types := array_append(coalesce(new.extra_types, '{}'), 'poster_presenter'::public.account_type);
  end if;
  return new;
end $$;

drop trigger if exists profiles_waitlist_poster on public.profiles;
create trigger profiles_waitlist_poster before insert or update on public.profiles
  for each row execute function public.waitlist_presents_poster();

drop trigger if exists delegate_roster_waitlist_poster on public.delegate_roster;
create trigger delegate_roster_waitlist_poster before insert or update on public.delegate_roster
  for each row execute function public.waitlist_presents_poster();

-- Everyone already on the waiting list.
update public.delegate_roster
   set extra_types = array_append(extra_types, 'poster_presenter'::public.account_type)
 where 'oral_waitlist' = any(public.all_types(account_type, extra_types))
   and not 'poster_presenter' = any(public.all_types(account_type, extra_types));

update public.profiles
   set extra_types = array_append(extra_types, 'poster_presenter'::public.account_type)
 where 'oral_waitlist' = any(public.all_types(account_type, extra_types))
   and not 'poster_presenter' = any(public.all_types(account_type, extra_types));
