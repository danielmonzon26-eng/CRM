-- A registration target for each event, next to its capacity (the maximum, which the
-- registration page enforces with a waitlist). Safe to re-run.

alter table public.events add column if not exists target_attendees integer;

alter table public.events drop constraint if exists events_target_attendees_check;
alter table public.events add constraint events_target_attendees_check
  check (target_attendees is null or target_attendees > 0);

alter table public.events drop constraint if exists events_target_within_capacity;
alter table public.events add constraint events_target_within_capacity
  check (target_attendees is null or capacity is null or target_attendees <= capacity);
