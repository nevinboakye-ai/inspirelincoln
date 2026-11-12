-- =====================================================================
-- Workshop ranking: open it now, and close it at 9pm UK time on Monday
-- 16 November 2026. Delegates see "Rank by Monday 16 November, 9 pm" in
-- My Hub. You can change either later on Workshop places.
--
-- Run after 29-workshop-choices.sql and 35-workshops-rank-six.sql.
-- =====================================================================

insert into public.workshop_choice_settings (edition_id, ranking_open, closes_at)
select id, true, timestamptz '2026-11-16 21:00 Europe/London'
  from public.editions where is_current
on conflict (edition_id) do update
  set ranking_open = true, closes_at = excluded.closes_at, updated_at = now();
