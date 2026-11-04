-- Lets a task belong to an event, so each event workspace has its own checklist and
-- timeline. Additive: existing tasks keep their lead or company.

alter table public.tasks
  add column if not exists event_id uuid references public.events (id) on delete cascade;

create index if not exists tasks_event_id_idx on public.tasks (event_id);

alter table public.tasks drop constraint if exists tasks_has_subject;
alter table public.tasks add constraint tasks_has_subject
  check (lead_id is not null or company_id is not null or event_id is not null);
