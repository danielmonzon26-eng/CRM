-- Full CRM module: deal fields on leads, and a tasks object (calls/emails/to-dos/
-- meetings) that can hang off a lead or stand alone against a company — the piece
-- HubSpot-style CRMs use to drive rep follow-up instead of relying on activity notes
-- alone.

alter table public.leads
  add column if not exists deal_value numeric,
  add column if not exists expected_close_date date;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  title text not null,
  description text,
  task_type text not null default 'todo'
    check (task_type in ('todo', 'call', 'email', 'meeting')),
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users (id),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_has_subject check (lead_id is not null or company_id is not null)
);

create index if not exists tasks_lead_id_idx on public.tasks (lead_id);
create index if not exists tasks_company_id_idx on public.tasks (company_id);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_due_at_idx on public.tasks (due_at);

drop trigger if exists set_updated_at on public.tasks;
create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "authenticated all tasks" on public.tasks;
create policy "authenticated all tasks" on public.tasks
  for all to authenticated using (true) with check (true);

-- activities.type gains 'task_completed' so finishing a task shows up on the lead
-- timeline alongside notes, status changes, etc.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in ('note', 'status_change', 'enrichment_run', 'email_sent', 'call_logged', 'sync_matched', 'task_completed'));
