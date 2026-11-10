-- People on the selected list can be given any account type before they
-- set up their account, including the supporting committee teams and the
-- executive committee. When they sign up they get that type, already approved.

alter table public.delegate_roster drop constraint if exists delegate_roster_account_type_check;

-- Only the president or vice president can put someone on the list as
-- executive committee (or move them off it), the same rule as for accounts.
create or replace function public.guard_roster_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if ((tg_op = 'INSERT' and new.account_type in ('executive_committee', 'vice_president', 'president'))
      or (tg_op = 'UPDATE' and new.account_type is distinct from old.account_type
          and (new.account_type in ('executive_committee', 'vice_president', 'president')
               or old.account_type in ('executive_committee', 'vice_president', 'president'))))
     and not public.is_leadership() then
    raise exception 'Only the president or vice president can put someone in the executive committee';
  end if;
  return new;
end $$;

drop trigger if exists delegate_roster_guard_type on public.delegate_roster;
create trigger delegate_roster_guard_type before insert or update on public.delegate_roster
  for each row execute function public.guard_roster_type();
