-- Custom questions on an event's registration form, and each registrant's answers.
-- Questions are a list on the event ([{id, label, type, options, required}]); answers are
-- keyed by question id on the registration. The registration function is unchanged:
-- the app checks answers first and saves them on the new registration. Safe to re-run.

alter table public.events
  add column if not exists registration_questions jsonb not null default '[]'::jsonb;
alter table public.events drop constraint if exists events_registration_questions_is_array;
alter table public.events add constraint events_registration_questions_is_array
  check (jsonb_typeof(registration_questions) = 'array');

alter table public.event_registrations
  add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.event_registrations drop constraint if exists event_registrations_answers_is_object;
alter table public.event_registrations add constraint event_registrations_answers_is_object
  check (jsonb_typeof(answers) = 'object');
