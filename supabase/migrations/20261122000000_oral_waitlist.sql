-- A category for people on the waiting list for an oral presentation.
-- Part 1 of 2: new enum values must be committed before they can be used.
alter type public.account_type add value if not exists 'oral_waitlist' after 'poster_presenter';
