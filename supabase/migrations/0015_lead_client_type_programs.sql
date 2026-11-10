-- Groups leads by client type (one per lead) and the Catapult programs they're interested in
-- (any number per lead). Both start empty on existing leads, and nothing else about a lead
-- changes. CRM search gains matching filters, returns both fields, and reports each lead's
-- latest proposal, so the Leads table can show and filter on it.

alter table public.leads
  add column if not exists client_type text,
  add column if not exists programs text[] not null default '{}';

-- These checks also accept the values 0018 maps leads to, since every migration re-runs
-- and these run first; 0018 then narrows them to the new values only.
alter table public.leads drop constraint if exists leads_client_type_check;
alter table public.leads add constraint leads_client_type_check check (
  client_type is null or client_type in ('government', 'private_business', 'small_business', 'medium_business', 'start_up', 'non_profit', 'private')
);

alter table public.leads drop constraint if exists leads_programs_check;
alter table public.leads add constraint leads_programs_check check (
  programs <@ array['events_education', 'catapult_ready', 'capital_raise', 'company_exit', 'ip_programs', 'revenue_growth', 'elevate_ip', 'education', 'operations_assistance', 'capital']::text[]
);

create index if not exists leads_client_type_idx on public.leads (client_type);
create index if not exists leads_programs_idx on public.leads using gin (programs);

-- Replaces the search functions from 0013, because their arguments and results change.
-- Migrations all re-run, so 0013's versions are recreated and dropped again each time.
drop function if exists public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid);
drop function if exists public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, boolean, integer, integer);
drop function if exists public.crm_filtered_leads(text, text, text, text, integer, text, uuid);
drop function if exists public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid, text, text, text);
drop function if exists public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, text, text, text, boolean, integer, integer);
drop function if exists public.crm_filtered_leads(text, text, text, text, integer, text, uuid, text, text, text);

create function public.crm_filtered_leads(
  p_search text,
  p_owner text,
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
    and (p_owner is null
         or (p_owner = 'unassigned' and l.assigned_to is null)
         or l.assigned_to::text = p_owner)
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
  p_owner text default null,
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
    select f.id, f.status, f.score, f.assigned_to, f.created_at, f.company_id, f.client_type, f.programs, co.name, co.community, co.industry
    from public.crm_filtered_leads(p_search, p_owner, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal) f
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
    p.id, p.status, p.score, p.assigned_to, p.created_at, p.company_id, p.name, p.community, p.industry,
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
  p_owner text default null,
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
  from public.crm_filtered_leads(p_search, p_owner, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal) f
  group by f.status;
$$;

-- Adds or removes one program across selected leads, keeping each lead's other programs.
create or replace function public.crm_change_lead_program(p_lead_ids uuid[], p_program text, p_add boolean)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.leads l
  set programs = case
    when p_add then (select coalesce(array_agg(distinct x), '{}') from unnest(array_append(l.programs, p_program)) x)
    else array_remove(l.programs, p_program)
  end
  where l.id = any (p_lead_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid, text, text, text) from public, anon;
revoke all on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, text, text, text, boolean, integer, integer) from public, anon;
revoke all on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid, text, text, text) from public, anon;
revoke all on function public.crm_change_lead_program(uuid[], text, boolean) from public, anon;
grant execute on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid, text, text, text) to authenticated;
grant execute on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, text, text, text, boolean, integer, integer) to authenticated;
grant execute on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid, text, text, text) to authenticated;
grant execute on function public.crm_change_lead_program(uuid[], text, boolean) to authenticated;
