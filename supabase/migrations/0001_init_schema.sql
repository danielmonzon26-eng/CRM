-- Step 2: core schema for the Calgary Lead Engine.
--
-- Pipeline shape: sources -> licenses (raw ingested records) -> companies (deduped
-- entities) -> leads (qualified working set) -> contacts / activities.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- sources: registry of every data source we pull from (Calgary Open Data today,
-- more adapters added in Step 8).
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  kind text not null check (kind in ('open_data_api', 'web_scrape', 'enrichment')),
  config jsonb not null default '{}',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- companies: deduped business entities. One row per real-world business,
-- matched/merged from one or more raw license records.
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  website text,
  domain text,
  phone text,
  address_line text,
  city text not null default 'Calgary',
  province text not null default 'AB',
  postal_code text,
  community text,
  industry text,
  naics_code text,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_normalized_name_idx on public.companies (normalized_name);
create index if not exists companies_domain_idx on public.companies (domain);
create index if not exists companies_community_idx on public.companies (community);

-- ---------------------------------------------------------------------------
-- licenses: raw records as ingested from a source (e.g. Calgary Business
-- Licences). Kept verbatim (in `raw`) for provenance/re-processing, plus a few
-- lifted columns for querying. `company_id` is set once matching runs.
-- ---------------------------------------------------------------------------
create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  company_id uuid references public.companies (id),
  external_id text not null,
  business_name text not null,
  license_type text,
  license_status text,
  description text,
  issue_date date,
  address text,
  community text,
  raw jsonb not null default '{}',
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists licenses_company_id_idx on public.licenses (company_id);
create index if not exists licenses_issue_date_idx on public.licenses (issue_date);
create index if not exists licenses_status_idx on public.licenses (license_status);

-- ---------------------------------------------------------------------------
-- leads: the qualified/working set — one row per company we're actively
-- pursuing. Promoted from `companies` by the Step 4 scoring engine.
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) unique,
  status text not null default 'new'
    check (status in ('new', 'researching', 'contacted', 'qualified', 'unqualified', 'won', 'lost')),
  score integer not null default 0,
  score_reasons jsonb not null default '[]',
  assigned_to uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);

-- ---------------------------------------------------------------------------
-- contacts: people found for a lead (execs, biz dev, marketing, etc.) via the
-- Step 5 enrichment pipeline or added manually.
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  full_name text not null,
  title text,
  email text,
  email_confidence integer,
  phone text,
  linkedin_url text,
  source text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_lead_id_idx on public.contacts (lead_id);
create index if not exists contacts_email_idx on public.contacts (email);

-- ---------------------------------------------------------------------------
-- activities: timeline/audit log per lead — status changes, notes, enrichment
-- runs, outreach events.
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references auth.users (id),
  type text not null
    check (type in ('note', 'status_change', 'enrichment_run', 'email_sent', 'call_logged', 'sync_matched')),
  body text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists activities_lead_id_idx on public.activities (lead_id);
create index if not exists activities_created_at_idx on public.activities (created_at);

-- ---------------------------------------------------------------------------
-- sync_runs: one row per cron execution, for observability/debugging.
-- ---------------------------------------------------------------------------
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_fetched integer not null default 0,
  records_new integer not null default 0,
  records_updated integer not null default 0,
  error text
);

create index if not exists sync_runs_source_id_idx on public.sync_runs (source_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger, applied to the mutable tables.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.companies;
create trigger set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.leads;
create trigger set_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.contacts;
create trigger set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security. Cron/admin routes use the service-role key, which
-- bypasses RLS entirely. These policies govern the CRM frontend: any signed-in
-- team member can read/write everything for now — role-based restrictions
-- (admin vs. rep) land in Step 7. No policies are defined for the `anon` role,
-- so unauthenticated access is denied by default.
-- ---------------------------------------------------------------------------
alter table public.sources enable row level security;
alter table public.companies enable row level security;
alter table public.licenses enable row level security;
alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.activities enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "authenticated read sources" on public.sources;
create policy "authenticated read sources" on public.sources
  for select to authenticated using (true);

drop policy if exists "authenticated all companies" on public.companies;
create policy "authenticated all companies" on public.companies
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all licenses" on public.licenses;
create policy "authenticated all licenses" on public.licenses
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all leads" on public.leads;
create policy "authenticated all leads" on public.leads
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all contacts" on public.contacts;
create policy "authenticated all contacts" on public.contacts
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all activities" on public.activities;
create policy "authenticated all activities" on public.activities
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read sync_runs" on public.sync_runs;
create policy "authenticated read sync_runs" on public.sync_runs
  for select to authenticated using (true);
