-- Supporting committee teams as their own account types.
-- Part 1 of 2: Postgres needs new enum values committed before they can be used,
-- so the access rules for them are set in the next migration.
alter type public.account_type add value if not exists 'academic_team' after 'supporting_committee';
alter type public.account_type add value if not exists 'publicity_team' after 'academic_team';
alter type public.account_type add value if not exists 'finance_team' after 'publicity_team';
alter type public.account_type add value if not exists 'logistics_team' after 'finance_team';
