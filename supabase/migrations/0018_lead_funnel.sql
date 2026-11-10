-- Lead status and stage from the Catapult funnel, plus the new client types and the work
-- Catapult does. Every lead belongs to a company, and these apply to the whole company.
--   Stage (leads.status): Engagement or Education -> In Contact -> Discovery Meeting ->
--     Client Meeting -> Proposal -> Client
--   Status (leads.engagement): Engaged, Not Engaged, Do Not Contact
--   Client type: Government, Non Profit, Private
--   Work we do (leads.programs): Elevate IP, Education, Operations Assistance, Capital
-- Old values are mapped once; each update only matches old values, so re-running is safe.
-- The Leads search drops its owner filter and filters on status instead.

alter table public.leads add column if not exists engagement text not null default 'not_engaged';
alter table public.leads drop constraint if exists leads_engagement_check;
alter table public.leads add constraint leads_engagement_check
  check (engagement in ('engaged', 'not_engaged', 'do_not_contact'));
create index if not exists leads_engagement_idx on public.leads (engagement);

-- Stage. Leads that were being worked count as engaged; lost and unqualified ones restart.
alter table public.leads drop constraint if exists leads_status_check;
update public.leads set engagement = 'engaged' where status in ('contacted', 'qualified', 'won');
update public.leads set status = case status
    when 'contacted' then 'in_contact'
    when 'qualified' then 'discovery_meeting'
    when 'won' then 'client'
    else 'engagement'
  end
  where status in ('new', 'researching', 'contacted', 'qualified', 'won', 'lost', 'unqualified');
alter table public.leads alter column status set default 'engagement';
alter table public.leads add constraint leads_status_check
  check (status in ('engagement', 'in_contact', 'discovery_meeting', 'client_meeting', 'proposal', 'client'));

-- Client type.
alter table public.leads drop constraint if exists leads_client_type_check;
update public.leads set client_type = 'private'
  where client_type in ('private_business', 'small_business', 'medium_business', 'start_up');
alter table public.leads add constraint leads_client_type_check
  check (client_type is null or client_type in ('government', 'non_profit', 'private'));

-- Work we do.
create or replace function public.map_old_lead_program(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p
    when 'ip_programs' then 'elevate_ip'
    when 'events_education' then 'education'
    when 'capital_raise' then 'capital'
    when 'catapult_ready' then 'operations_assistance'
    when 'company_exit' then 'operations_assistance'
    when 'revenue_growth' then 'operations_assistance'
    else p
  end;
$$;
revoke all on function public.map_old_lead_program(text) from public, anon;

alter table public.leads drop constraint if exists leads_programs_check;
update public.leads l set programs = coalesce(
    (select array_agg(distinct public.map_old_lead_program(p)) from unnest(l.programs) p), '{}')
  where l.programs && array['ip_programs', 'events_education', 'capital_raise', 'catapult_ready', 'company_exit', 'revenue_growth'];
alter table public.leads add constraint leads_programs_check
  check (programs <@ array['elevate_ip', 'education', 'operations_assistance', 'capital']::text[]);

-- A proposal moves its lead to the Proposal stage, and a won proposal makes it a Client.
-- Stages only move forward this way; people can still set any stage by hand.
create or replace function public.sync_lead_stage_from_deal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.lead_id is null then
    return new;
  end if;
  if new.stage = 'closed_won' then
    update public.leads
      set status = 'client',
          engagement = case when engagement = 'do_not_contact' then engagement else 'engaged' end
      where id = new.lead_id and status <> 'client';
  elsif tg_op = 'INSERT' then
    update public.leads set status = 'proposal'
      where id = new.lead_id and status in ('engagement', 'in_contact', 'discovery_meeting', 'client_meeting');
    update public.leads set engagement = 'engaged'
      where id = new.lead_id and engagement = 'not_engaged';
  end if;
  return new;
end;
$$;
revoke all on function public.sync_lead_stage_from_deal() from public, anon;

drop trigger if exists deals_sync_lead_stage on public.deals;
create trigger deals_sync_lead_stage
  after insert or update of stage on public.deals
  for each row execute function public.sync_lead_stage_from_deal();

-- Leads that already have proposals catch up once.
update public.leads l set status = 'client'
  where l.status <> 'client'
    and exists (select 1 from public.deals d where d.lead_id = l.id and d.stage = 'closed_won');
update public.leads l set status = 'proposal'
  where l.status in ('engagement', 'in_contact', 'discovery_meeting', 'client_meeting')
    and exists (select 1 from public.deals d where d.lead_id = l.id);

-- Who counts as a lead: the Leads page lists Engaged companies only. A company becomes
-- Engaged when someone registers for an event, when it gets a proposal (above), or when
-- its stage moves past Engagement or Education. Not Engaged and Do Not Contact companies
-- only show under Contacts and Companies. Do Not Contact is never changed automatically.
create or replace function public.engage_lead_on_stage_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('in_contact', 'discovery_meeting', 'client_meeting', 'proposal', 'client')
     and new.engagement = 'not_engaged' then
    new.engagement := 'engaged';
  end if;
  return new;
end;
$$;
revoke all on function public.engage_lead_on_stage_change() from public, anon;

drop trigger if exists leads_engage_on_stage_change on public.leads;
create trigger leads_engage_on_stage_change
  before update of status on public.leads
  for each row execute function public.engage_lead_on_stage_change();

-- Registration runs through public event pages, so this updates the lead as the table owner.
create or replace function public.engage_lead_on_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lead_id is not null and new.status <> 'cancelled' then
    update public.leads set engagement = 'engaged'
      where id = new.lead_id and engagement = 'not_engaged';
  end if;
  return new;
end;
$$;
revoke all on function public.engage_lead_on_registration() from public, anon, authenticated;

drop trigger if exists event_registrations_engage_lead on public.event_registrations;
create trigger event_registrations_engage_lead
  after insert or update of lead_id, status on public.event_registrations
  for each row execute function public.engage_lead_on_registration();

-- Existing event attendees and companies with proposals become leads once.
update public.leads l set engagement = 'engaged'
  where l.engagement = 'not_engaged'
    and (exists (select 1 from public.event_registrations r where r.lead_id = l.id and r.status <> 'cancelled')
         or exists (select 1 from public.deals d where d.lead_id = l.id));

-- Search functions: same argument types as 0015, so 0015's drops also remove these on a
-- re-run. The owner filter becomes a status filter, and results include status.
drop function if exists public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid, text, text, text);
drop function if exists public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, text, text, text, boolean, integer, integer);
drop function if exists public.crm_filtered_leads(text, text, text, text, integer, text, uuid, text, text, text);

create function public.crm_filtered_leads(
  p_search text,
  p_engagement text,
  p_industry text,
  p_community text,
  p_min_score integer,
  p_contact text,
  p_event_id uuid,
  p_client_type text,
  p_program text,
  p_proposal text
)
returns setof public.leads
language sql
stable
security invoker
set search_path = ''
as $$
  with term as (
    -- Treats % and _ in what someone types as ordinary characters.
    select '%' || replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select l.*
  from public.leads l
  join public.companies co on co.id = l.company_id
  cross join term
  where (coalesce(trim(p_search), '') = '' or co.name ilike term.pattern or exists (
          select 1 from public.contacts c
          where c.lead_id = l.id
            and (c.full_name ilike term.pattern or c.email ilike term.pattern or c.title ilike term.pattern)
        ))
    and (p_engagement is null or l.engagement = p_engagement)
    and (p_industry is null or co.industry = p_industry)
    and (p_community is null or co.community = p_community)
    and (p_min_score is null or l.score >= p_min_score)
    and (p_contact is null
         or (p_contact = 'has_contact' and exists (select 1 from public.contacts c where c.lead_id = l.id))
         or (p_contact = 'has_email' and exists (select 1 from public.contacts c where c.lead_id = l.id and c.email is not null))
         or (p_contact = 'none' and not exists (select 1 from public.contacts c where c.lead_id = l.id)))
    and (p_event_id is null or exists (
          select 1 from public.event_registrations r
          where r.lead_id = l.id and r.event_id = p_event_id and r.status <> 'cancelled'
        ))
    and (p_client_type is null
         or (p_client_type = 'none' and l.client_type is null)
         or l.client_type = p_client_type)
    and (p_program is null
         or (p_program = 'none' and l.programs = '{}')
         or l.programs @> array[p_program])
    and (p_proposal is null
         or (p_proposal = 'has' and exists (select 1 from public.deals d where d.lead_id = l.id))
         or (p_proposal = 'none' and not exists (select 1 from public.deals d where d.lead_id = l.id)));
$$;

create function public.crm_search_leads(
  p_search text default null,
  p_statuses text[] default null,
  p_engagement text default null,
  p_industry text default null,
  p_community text default null,
  p_min_score integer default null,
  p_contact text default null,
  p_event_id uuid default null,
  p_client_type text default null,
  p_program text default null,
  p_proposal text default null,
  p_sort text default 'score',
  p_descending boolean default true,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  status text,
  engagement text,
  score integer,
  assigned_to uuid,
  created_at timestamptz,
  company_id uuid,
  company_name text,
  community text,
  industry text,
  client_type text,
  programs text[],
  primary_name text,
  primary_title text,
  primary_email text,
  primary_contact_id uuid,
  contact_count integer,
  proposal_id uuid,
  proposal_stage text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select f.id, f.status, f.engagement, f.score, f.assigned_to, f.created_at, f.company_id, f.client_type, f.programs, co.name, co.community, co.industry
    from public.crm_filtered_leads(p_search, p_engagement, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal) f
    join public.companies co on co.id = f.company_id
    where p_statuses is null or f.status = any (p_statuses)
  ),
  page as (
    select m.*, count(*) over () as total_count
    from matched m
    order by
      case when p_sort = 'name' and p_descending then lower(m.name) end desc,
      case when p_sort = 'name' and not p_descending then lower(m.name) end asc,
      case when p_sort = 'score' and p_descending then m.score end desc,
      case when p_sort = 'score' and not p_descending then m.score end asc,
      case when p_sort = 'created' and p_descending then m.created_at end desc,
      case when p_sort = 'created' and not p_descending then m.created_at end asc,
      case when p_sort = 'status' and p_descending then m.status end desc,
      case when p_sort = 'status' and not p_descending then m.status end asc,
      case when p_sort = 'client_type' and p_descending then m.client_type end desc nulls last,
      case when p_sort = 'client_type' and not p_descending then m.client_type end asc nulls last,
      -- Ties always come back in one order, so paging never repeats or skips a lead.
      lower(m.name), m.id
    limit greatest(least(p_limit, 500), 1)
    offset greatest(p_offset, 0)
  )
  select
    p.id, p.status, p.engagement, p.score, p.assigned_to, p.created_at, p.company_id, p.name, p.community, p.industry,
    p.client_type, p.programs,
    pc.full_name, pc.title, pc.email, pc.id,
    (select count(*)::integer from public.contacts c where c.lead_id = p.id),
    latest.id, latest.stage,
    p.total_count
  from page p
  left join lateral (
    select c.id, c.full_name, c.title, c.email from public.contacts c
    where c.lead_id = p.id
    order by c.is_primary desc, c.created_at
    limit 1
  ) pc on true
  left join lateral (
    select d.id, d.stage from public.deals d
    where d.lead_id = p.id
    order by d.created_at desc
    limit 1
  ) latest on true
  order by
    case when p_sort = 'name' and p_descending then lower(p.name) end desc,
    case when p_sort = 'name' and not p_descending then lower(p.name) end asc,
    case when p_sort = 'score' and p_descending then p.score end desc,
    case when p_sort = 'score' and not p_descending then p.score end asc,
    case when p_sort = 'created' and p_descending then p.created_at end desc,
    case when p_sort = 'created' and not p_descending then p.created_at end asc,
    case when p_sort = 'status' and p_descending then p.status end desc,
    case when p_sort = 'status' and not p_descending then p.status end asc,
    case when p_sort = 'client_type' and p_descending then p.client_type end desc nulls last,
    case when p_sort = 'client_type' and not p_descending then p.client_type end asc nulls last,
    lower(p.name), p.id;
$$;

create function public.crm_lead_stage_counts(
  p_search text default null,
  p_engagement text default null,
  p_industry text default null,
  p_community text default null,
  p_min_score integer default null,
  p_contact text default null,
  p_event_id uuid default null,
  p_client_type text default null,
  p_program text default null,
  p_proposal text default null
)
returns table (status text, lead_count bigint, open_value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    f.status,
    count(*),
    coalesce(sum((
      select sum(d.amount) from public.deals d
      where d.lead_id = f.id and d.stage not in ('closed_won', 'closed_lost')
    )), 0)
  from public.crm_filtered_leads(p_search, p_engagement, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal) f
  group by f.status;
$$;

revoke all on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid, text, text, text) from public, anon;
revoke all on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, text, text, text, boolean, integer, integer) from public, anon;
revoke all on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid, text, text, text) from public, anon;
grant execute on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid, text, text, text) to authenticated;
grant execute on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, text, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid, text, text, text) to authenticated;
