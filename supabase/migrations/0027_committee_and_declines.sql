-- Who's involved in each proposal (the buying committee), and why a proposal was declined,
-- with "they declined" kept apart from "we declined". Safe to re-run.

create table if not exists public.deal_people (
  deal_id uuid not null references public.deals (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role text not null check (role in ('decision_maker', 'champion', 'finance', 'technical', 'end_user', 'blocker', 'other')),
  created_at timestamptz not null default now(),
  primary key (deal_id, contact_id)
);
create index if not exists deal_people_contact_id_idx on public.deal_people (contact_id);

alter table public.deal_people enable row level security;
drop policy if exists "authenticated all deal_people" on public.deal_people;
create policy "authenticated all deal_people" on public.deal_people
  for all to authenticated using (true) with check (true);
revoke all on table public.deal_people from anon;

alter table public.deals
  add column if not exists declined_by text,
  add column if not exists declined_reason text;

alter table public.deals drop constraint if exists deals_declined_by_check;
alter table public.deals add constraint deals_declined_by_check
  check (declined_by is null or declined_by in ('them', 'us'));
alter table public.deals drop constraint if exists deals_declined_reason_check;
alter table public.deals add constraint deals_declined_reason_check
  check (declined_reason is null or declined_reason in (
    'price', 'timing', 'no_budget', 'chose_another', 'no_decision', 'went_quiet', 'not_a_fit', 'capacity', 'other'
  ));
