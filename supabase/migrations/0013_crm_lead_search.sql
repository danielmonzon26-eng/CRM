-- Server-side search and filtering for the CRM board and table, so a page loads only what it
-- shows rather than every lead. Read-only. Runs with the caller's rights, so existing access
-- rules still apply, and only signed-in users can call these.

create index if not exists leads_status_score_idx on public.leads (status, score desc);
create index if not exists leads_assigned_to_idx on public.leads (assigned_to);
create index if not exists contacts_lead_id_idx on public.contacts (lead_id);

create or replace function public.crm_filtered_leads(
  p_search text,
  p_owner text,
  p_industry text,
  p_community text,
  p_min_score integer,
  p_contact text,
  p_event_id uuid
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
        ));
$$;

create or replace function public.crm_search_leads(
  p_search text default null,
  p_statuses text[] default null,
  p_owner text default null,
  p_industry text default null,
  p_community text default null,
  p_min_score integer default null,
  p_contact text default null,
  p_event_id uuid default null,
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
  primary_name text,
  primary_title text,
  primary_email text,
  contact_count integer,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select f.id, f.status, f.score, f.assigned_to, f.created_at, f.company_id, co.name, co.community, co.industry
    from public.crm_filtered_leads(p_search, p_owner, p_industry, p_community, p_min_score, p_contact, p_event_id) f
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
      -- Ties always come back in one order, so paging never repeats or skips a lead.
      lower(m.name), m.id
    limit greatest(least(p_limit, 500), 1)
    offset greatest(p_offset, 0)
  )
  select
    p.id, p.status, p.score, p.assigned_to, p.created_at, p.company_id, p.name, p.community, p.industry,
    pc.full_name, pc.title, pc.email,
    (select count(*)::integer from public.contacts c where c.lead_id = p.id),
    p.total_count
  from page p
  left join lateral (
    select c.full_name, c.title, c.email from public.contacts c
    where c.lead_id = p.id
    order by c.is_primary desc, c.created_at
    limit 1
  ) pc on true
  order by
    case when p_sort = 'name' and p_descending then lower(p.name) end desc,
    case when p_sort = 'name' and not p_descending then lower(p.name) end asc,
    case when p_sort = 'score' and p_descending then p.score end desc,
    case when p_sort = 'score' and not p_descending then p.score end asc,
    case when p_sort = 'created' and p_descending then p.created_at end desc,
    case when p_sort = 'created' and not p_descending then p.created_at end asc,
    case when p_sort = 'status' and p_descending then p.status end desc,
    case when p_sort = 'status' and not p_descending then p.status end asc,
    lower(p.name), p.id;
$$;

-- Lead count and open deal value per stage, under the same filters.
create or replace function public.crm_lead_stage_counts(
  p_search text default null,
  p_owner text default null,
  p_industry text default null,
  p_community text default null,
  p_min_score integer default null,
  p_contact text default null,
  p_event_id uuid default null
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
  from public.crm_filtered_leads(p_search, p_owner, p_industry, p_community, p_min_score, p_contact, p_event_id) f
  group by f.status;
$$;

-- Filter choices, most common first.
create or replace function public.crm_lead_facets()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'industries', coalesce((
      select jsonb_agg(t.industry order by t.n desc, t.industry)
      from (
        select co.industry, count(*) as n
        from public.leads l join public.companies co on co.id = l.company_id
        where co.industry is not null
        group by co.industry
        order by n desc, co.industry
        limit 100
      ) t
    ), '[]'::jsonb),
    'communities', coalesce((
      select jsonb_agg(t.community order by t.community)
      from (
        select distinct co.community
        from public.leads l join public.companies co on co.id = l.company_id
        where co.community is not null
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid) from public;
revoke all on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, boolean, integer, integer) from public;
revoke all on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid) from public;
revoke all on function public.crm_lead_facets() from public;
grant execute on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid) to authenticated;
grant execute on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, boolean, integer, integer) to authenticated;
grant execute on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid) to authenticated;
grant execute on function public.crm_lead_facets() to authenticated;
