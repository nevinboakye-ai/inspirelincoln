-- Judges and speakers: two account types for the professionals who come on
-- the day. Part 1 of 2: Postgres needs new enum values committed before they
-- can be used, so everything that uses them is in the next migration.
alter type public.account_type add value if not exists 'speaker' after 'oral_waitlist';
alter type public.account_type add value if not exists 'judge' after 'speaker';
