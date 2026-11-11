-- A livelier name and description for workshop 2 (clinical cases simulation). URL unchanged.
begin;
update public.workshops set title = 'Doctor for the Day: Clinical Cases Simulation', strapline = 'Your team. Your patient. Your call.', summary = 'Step into the shoes of the clinical team and work together to assess and treat patients in live, interactive simulations.', description = 'A patient needs your help, and your team is on call. In this interactive simulation you''ll work in groups to take on clinical cases as they unfold: assessing the patient, deciding what to do next and agreeing a plan together, under pressure. It''s the closest thing to being the doctor in charge, in a setting where it''s safe to make mistakes and learn from them. Expect to think on your feet, speak up in your team and leave more confident about managing patients.'
 where number = 2 and edition_id = (select id from public.editions where year = 2026);
commit;
