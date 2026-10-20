-- Step 1: deals table -- a revenue opportunity, distinct from lead qualification.
-- A deal is created once a lead is qualified; it tracks its own stage/forecast
-- independently of the lead's prospecting status.
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads (id) on delete set null,
  company_id uuid not null references public.companies (id) on delete cascade,
  primary_contact_id uuid references public.contacts (id) on delete set null,
  name text not null,
  owner uuid references auth.users (id),
  pipeline text not null default 'default',
  stage text not null default 'discovery_scheduled'
    check (stage in (
      'discovery_scheduled', 'discovery_completed', 'qualified_opportunity',
      'proposal_sent', 'negotiation_decision', 'closed_won', 'closed_lost'
    )),
  amount numeric not null,
  currency text not null default 'CAD',
  expected_close_date date not null,
  probability numeric check (probability is null or (probability >= 0 and probability <= 100)),
  lead_source text,
  next_step text,
  next_step_due_date date,
  last_activity_at timestamptz,
  competitors text,
  lost_reason text,
  closed_at timestamptz,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_lost_reason_requires_closed_lost
    check (lost_reason is null or stage = 'closed_lost')
);

-- Step 2: stage transition history, for audit and pipeline-health reporting.
create table if not exists public.deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now()
);

-- Step 3: indexes
create index if not exists deals_company_id_idx on public.deals (company_id);
create index if not exists deals_lead_id_idx on public.deals (lead_id);
create index if not exists deals_stage_idx on public.deals (stage);
create index if not exists deals_owner_idx on public.deals (owner);
create index if not exists deal_stage_history_deal_id_idx on public.deal_stage_history (deal_id);

-- Step 4: updated_at trigger (reuses the existing set_updated_at() function)
create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- Step 5: RLS, matching every other table's authenticated-only policy
alter table public.deals enable row level security;
alter table public.deal_stage_history enable row level security;

create policy "authenticated all deals" on public.deals
  for all to authenticated using (true) with check (true);

create policy "authenticated all deal_stage_history" on public.deal_stage_history
  for all to authenticated using (true) with check (true);

-- Step 6: extend the activities type check to cover deal events
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type in (
    'status_change', 'enrichment_run', 'email_sent', 'call_logged', 'sync_matched',
    'task_completed', 'note', 'deal_created', 'deal_stage_change'
  ));
