-- Marketing items can be assigned to a team member, like tasks, so each person can see
-- everything assigned to them on the Assignments page. Safe to re-run.

alter table public.marketing_items
  add column if not exists assigned_to uuid references auth.users (id) on delete set null;

create index if not exists marketing_items_assigned_to_idx on public.marketing_items (assigned_to) where assigned_to is not null;
