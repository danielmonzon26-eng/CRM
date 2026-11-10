-- Proposals: four stages (In Development, Sent, Accepted, Declined) and the details
-- Catapult tracks on each one: the work it covers, staff on it, paid or unpaid, the
-- dates it was sent and accepted, and uploaded copies of the proposal.
-- Old stages are mapped once; each update only matches old values, so re-running is safe.

-- Stages.
alter table public.deals drop constraint if exists deals_stage_check;
alter table public.deals drop constraint if exists deals_lost_reason_requires_closed_lost;
alter table public.deals drop constraint if exists deals_lost_reason_requires_declined;

update public.deals set stage = case stage
    when 'proposal_sent' then 'sent'
    when 'negotiation_decision' then 'sent'
    when 'closed_won' then 'accepted'
    when 'closed_lost' then 'declined'
    else 'in_development'
  end
  where stage in ('discovery_scheduled', 'discovery_completed', 'qualified_opportunity', 'proposal_sent',
                  'negotiation_decision', 'closed_won', 'closed_lost');

update public.deal_stage_history set from_stage = case from_stage
    when 'proposal_sent' then 'sent'
    when 'negotiation_decision' then 'sent'
    when 'closed_won' then 'accepted'
    when 'closed_lost' then 'declined'
    else 'in_development'
  end
  where from_stage in ('discovery_scheduled', 'discovery_completed', 'qualified_opportunity', 'proposal_sent',
                       'negotiation_decision', 'closed_won', 'closed_lost');
update public.deal_stage_history set to_stage = case to_stage
    when 'proposal_sent' then 'sent'
    when 'negotiation_decision' then 'sent'
    when 'closed_won' then 'accepted'
    when 'closed_lost' then 'declined'
    else 'in_development'
  end
  where to_stage in ('discovery_scheduled', 'discovery_completed', 'qualified_opportunity', 'proposal_sent',
                     'negotiation_decision', 'closed_won', 'closed_lost');
-- History rows that now read "Sent -> Sent" or similar say nothing, so they go.
delete from public.deal_stage_history where from_stage = to_stage;

alter table public.deals alter column stage set default 'in_development';
alter table public.deals add constraint deals_stage_check
  check (stage in ('in_development', 'sent', 'accepted', 'declined'));
alter table public.deals add constraint deals_lost_reason_requires_declined
  check (lost_reason is null or stage = 'declined');

-- Details.
alter table public.deals
  add column if not exists work_types text[] not null default '{}',
  add column if not exists payment text,
  add column if not exists sent_on date,
  add column if not exists accepted_on date;

alter table public.deals drop constraint if exists deals_work_types_check;
alter table public.deals add constraint deals_work_types_check
  check (work_types <@ array['elevate_ip', 'education', 'operations_assistance', 'capital']::text[]);
alter table public.deals drop constraint if exists deals_payment_check;
alter table public.deals add constraint deals_payment_check
  check (payment is null or payment in ('paid', 'unpaid'));

-- Existing proposals pick up dates and work from what's already known, once.
update public.deals d set sent_on = coalesce(
    (select min(h.changed_at)::date from public.deal_stage_history h where h.deal_id = d.id and h.to_stage = 'sent'),
    d.created_at::date)
  where d.sent_on is null and d.stage in ('sent', 'accepted', 'declined');
update public.deals set accepted_on = coalesce(closed_at::date, updated_at::date)
  where accepted_on is null and stage = 'accepted';
update public.deals d set work_types = l.programs
  from public.leads l
  where l.id = d.lead_id and d.work_types = '{}' and l.programs <> '{}'
    and l.programs <@ array['elevate_ip', 'education', 'operations_assistance', 'capital']::text[];

-- Staff working on each proposal.
create table if not exists public.deal_staff (
  deal_id uuid not null references public.deals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deal_id, user_id)
);
create index if not exists deal_staff_user_id_idx on public.deal_staff (user_id);

alter table public.deal_staff enable row level security;
drop policy if exists "authenticated all deal_staff" on public.deal_staff;
create policy "authenticated all deal_staff" on public.deal_staff
  for all to authenticated using (true) with check (true);
revoke all on table public.deal_staff from anon;

-- The proposal's owner was the only staff field before, so they carry over.
insert into public.deal_staff (deal_id, user_id)
  select id, owner from public.deals where owner is not null
  on conflict do nothing;

-- Uploaded copies of the proposal, in a private bucket only the team can reach.
create table if not exists public.deal_files (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint,
  content_type text,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists deal_files_deal_id_idx on public.deal_files (deal_id);

alter table public.deal_files enable row level security;
drop policy if exists "authenticated all deal_files" on public.deal_files;
create policy "authenticated all deal_files" on public.deal_files
  for all to authenticated using (true) with check (true);
revoke all on table public.deal_files from anon;

insert into storage.buckets (id, name, public, file_size_limit)
values ('proposal-files', 'proposal-files', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "authenticated manage proposal files" on storage.objects;
create policy "authenticated manage proposal files" on storage.objects
  for all to authenticated
  using (bucket_id = 'proposal-files')
  with check (bucket_id = 'proposal-files');
