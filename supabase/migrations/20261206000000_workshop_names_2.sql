-- Livelier names for workshops 3 and 6. URLs are unchanged.
begin;
update public.workshops set title = 'Don''t Believe the Headline: Spotting Research You Can Trust', strapline = 'Read critically. Decide well.', summary = 'Learn to tell a strong study from a weak one, a skill you''ll use in journal clubs, exams and on the wards.'
 where number = 3 and edition_id = (select id from public.editions where year = 2026);
update public.workshops set title = 'The App Will See You Now: Who Digital Health Leaves Behind', strapline = 'Not every patient you treat will be online.', summary = 'Explore why the same technology can transform care for some patients and shut others out, in the UK and around the world.'
 where number = 6 and edition_id = (select id from public.editions where year = 2026);
commit;
