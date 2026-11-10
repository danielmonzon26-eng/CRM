-- Discovery calls: the Catapult Discovery Call Questionnaire (Business Model Canvas) filled
-- in per call, attached to the lead and its company. Each call is scored on how much of
-- the canvas it covered; the lead keeps its latest score for lists. Safe to re-run.

create table if not exists public.discovery_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  prospect_name text,
  call_date date not null default current_date,
  include_expansion boolean not null default false,
  -- Notes per question, keyed by question id (see lib/discovery/questionnaire.ts).
  answers jsonb not null default '{}',
  -- Complete / Partial / Unknown per BMC block, keyed by block id.
  block_status jsonb not null default '{}',
  -- Completion %: Complete = 1, Partial = 0.5, Unknown = 0, over the 9 blocks.
  score numeric(5, 2) not null default 0 check (score between 0 and 100),
  consultant_experience text check (consultant_experience in ('good', 'bad', 'none', 'unknown')),
  consultant_notes text,
  pricing_discussed boolean,
  decision_maker_present boolean,
  flags text[] not null default '{}',
  recommended_entry text,
  entry_reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_calls_lead_id_idx on public.discovery_calls (lead_id, call_date desc);
create index if not exists discovery_calls_company_id_idx on public.discovery_calls (company_id);

drop trigger if exists discovery_calls_set_updated_at on public.discovery_calls;
create trigger discovery_calls_set_updated_at before update on public.discovery_calls
  for each row execute function public.set_updated_at();

alter table public.discovery_calls enable row level security;
drop policy if exists "authenticated all discovery_calls" on public.discovery_calls;
create policy "authenticated all discovery_calls" on public.discovery_calls
  for all to authenticated using (true) with check (true);
revoke all on table public.discovery_calls from anon;

-- The latest call's score, kept on the lead so lists can show and sort by it.
alter table public.leads add column if not exists bmc_score numeric(5, 2);

create or replace function public.refresh_lead_bmc_score()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lead_id uuid := coalesce(new.lead_id, old.lead_id);
begin
  update public.leads l set bmc_score = (
    select c.score from public.discovery_calls c
    where c.lead_id = v_lead_id
    order by c.call_date desc, c.created_at desc
    limit 1
  )
  where l.id = v_lead_id;
  if tg_op = 'UPDATE' and old.lead_id is distinct from new.lead_id then
    update public.leads l set bmc_score = (
      select c.score from public.discovery_calls c
      where c.lead_id = old.lead_id
      order by c.call_date desc, c.created_at desc
      limit 1
    )
    where l.id = old.lead_id;
  end if;
  return null;
end;
$$;
revoke all on function public.refresh_lead_bmc_score() from public, anon;

drop trigger if exists discovery_calls_refresh_lead_score on public.discovery_calls;
create trigger discovery_calls_refresh_lead_score
  after insert or update of score, call_date, lead_id or delete on public.discovery_calls
  for each row execute function public.refresh_lead_bmc_score();
