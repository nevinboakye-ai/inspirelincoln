-- Research study: ethics and governance details become optional.
--
-- The study can now be switched on by the research team without recording
-- an ethics approval, governance confirmation or lead researcher. The
-- columns stay, so approval details can still be recorded (and are shown to
-- participants) if the study is later reviewed. Switching on still needs
-- the questionnaire windows in order and the data not yet anonymised.
-- Safe to run more than once.

alter table public.research_study drop constraint if exists research_on_needs_approval;
alter table public.research_study drop constraint if exists research_on_needs_windows;
alter table public.research_study add constraint research_on_needs_windows check (
  not enabled or (
    pre_closes_at <= post_opens_at and post_opens_at < post_closes_at
    and post_closes_at <= followup_opens_at and followup_opens_at < followup_closes_at
    and anonymised_at is null
  )
);
