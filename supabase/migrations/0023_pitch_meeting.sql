-- Matches the funnel diagram: the stage after Discovery Meeting is Pitch Meeting (was
-- Client Meeting), and Status is Engaged, Not Engaged or Do Not Contact (Not Qualified is
-- folded into Not Engaged). 0018 accepts the old and new names so every migration can
-- re-run; this maps the stored values once and narrows the checks. Safe to re-run.

alter table public.leads drop constraint if exists leads_status_check;
update public.leads set status = 'pitch_meeting' where status = 'client_meeting';
alter table public.leads add constraint leads_status_check
  check (status in ('engagement', 'in_contact', 'discovery_meeting', 'pitch_meeting', 'proposal', 'client'));

alter table public.leads drop constraint if exists leads_engagement_check;
update public.leads set engagement = 'not_engaged' where engagement = 'not_qualified';
alter table public.leads add constraint leads_engagement_check
  check (engagement in ('engaged', 'not_engaged', 'do_not_contact'));
