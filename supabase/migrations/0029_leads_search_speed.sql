-- Speeds up the Leads page. The search functions from 0026 were planned once for any
-- filter, so Postgres couldn't tell a "Needs me today" search from an "All leads" one and
-- worked out every lead's last touch again for each row: fine with a few leads, a
-- timeout with thousands. They're now PL/pgSQL planned with the actual filter values
-- each time (plan_cache_mode = force_custom_plan), which lets Postgres compute last
-- touch once, or skip it when the view doesn't need it. Same names, arguments and
-- results, so nothing calling them changes. crm_lead_view_counts adds the six saved-view
-- counts in one query instead of six. Safe to re-run.

create or replace function public.crm_filtered_leads(
  p_search text,
  p_engagement text,
  p_industry text,
  p_community text,
  p_min_score integer,
  p_contact text,
  p_event_id uuid,
  p_client_type text,
  p_program text,
  p_proposal text,
  p_view text
)
returns setof public.leads
language plpgsql
stable
security invoker
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with term as (
    -- Treats % and _ in what someone types as ordinary characters.
    select '%' || replace(replace(replace(trim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select l.*
  from public.leads l
  join public.companies co on co.id = l.company_id
  left join public.lead_touch lt on lt.lead_id = l.id
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
         or (p_proposal = 'none' and not exists (select 1 from public.deals d where d.lead_id = l.id)))
    -- Saved views. Clients are done, so they never need chasing.
    and (p_view is null or p_view = 'all'
         or (p_view = 'needs_me' and l.status <> 'client'
             and (lt.awaiting_us or lt.overdue or lt.last_touch_at is null or lt.last_touch_at < now() - interval '14 days'))
         or (p_view = 'stalled' and l.status <> 'client'
             and (lt.last_touch_at is null or lt.last_touch_at < now() - interval '14 days'))
         or (p_view = 'no_next_step' and l.status <> 'client' and not coalesce(lt.has_next_step, false))
         or (p_view = 'decision_month' and coalesce(lt.decision_this_month, false))
         or (p_view = 'low_bmc' and l.bmc_score is not null and l.bmc_score < 50));
end;
$$;

create or replace function public.crm_search_leads(
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
  p_view text default null,
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
  last_touch_at timestamptz,
  awaiting_us boolean,
  overdue boolean,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with matched as (
    select f.id, f.status, f.engagement, f.score, f.assigned_to, f.created_at, f.company_id, f.client_type, f.programs, co.name, co.community, co.industry,
      lt.last_touch_at, coalesce(lt.awaiting_us, false) as awaiting_us, coalesce(lt.overdue, false) as overdue
    from public.crm_filtered_leads(p_search, p_engagement, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal, p_view) f
    join public.companies co on co.id = f.company_id
    left join public.lead_touch lt on lt.lead_id = f.id
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
      -- Last touch: most recent first when descending; never-contacted leads count as oldest.
      case when p_sort = 'touch' and p_descending then m.last_touch_at end desc nulls last,
      case when p_sort = 'touch' and not p_descending then m.last_touch_at end asc nulls first,
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
    p.last_touch_at, p.awaiting_us, p.overdue,
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
    case when p_sort = 'touch' and p_descending then p.last_touch_at end desc nulls last,
    case when p_sort = 'touch' and not p_descending then p.last_touch_at end asc nulls first,
    lower(p.name), p.id;
end;
$$;

create or replace function public.crm_lead_stage_counts(
  p_search text default null,
  p_engagement text default null,
  p_industry text default null,
  p_community text default null,
  p_min_score integer default null,
  p_contact text default null,
  p_event_id uuid default null,
  p_client_type text default null,
  p_program text default null,
  p_proposal text default null,
  p_view text default null
)
returns table (status text, lead_count bigint, open_value numeric)
language plpgsql
stable
security invoker
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  select
    f.status,
    count(*),
    coalesce(sum((
      select sum(d.amount) from public.deals d
      where d.lead_id = f.id and d.stage not in ('closed_won', 'closed_lost', 'accepted', 'declined')
    )), 0)
  from public.crm_filtered_leads(p_search, p_engagement, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal, p_view) f
  group by f.status;
end;
$$;

-- How many leads are in each saved view, with the other filters applied, in one query.
create or replace function public.crm_lead_view_counts(
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
  p_proposal text default null
)
returns table (view text, lead_count bigint)
language plpgsql
stable
security invoker
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
#variable_conflict use_column
begin
  return query
  with f as (
    select l.id, l.status, l.bmc_score
    from public.crm_filtered_leads(p_search, p_engagement, p_industry, p_community, p_min_score, p_contact, p_event_id, p_client_type, p_program, p_proposal, null) l
    where p_statuses is null or l.status = any (p_statuses)
  ),
  t as (
    select f.status, f.bmc_score,
      coalesce(lt.awaiting_us, false) as awaiting_us,
      coalesce(lt.overdue, false) as overdue,
      coalesce(lt.has_next_step, false) as has_next_step,
      coalesce(lt.decision_this_month, false) as decision_this_month,
      lt.last_touch_at is null or lt.last_touch_at < now() - interval '14 days' as quiet
    from f
    left join public.lead_touch lt on lt.lead_id = f.id
  )
  select v.view, v.n
  from (
    select
      count(*) filter (where status <> 'client' and (awaiting_us or overdue or quiet)) as needs_me,
      count(*) as all_leads,
      count(*) filter (where status <> 'client' and quiet) as stalled,
      count(*) filter (where status <> 'client' and not has_next_step) as no_next_step,
      count(*) filter (where decision_this_month) as decision_month,
      count(*) filter (where bmc_score is not null and bmc_score < 50) as low_bmc
    from t
  ) c
  cross join lateral (values
    ('needs_me', c.needs_me), ('all', c.all_leads), ('stalled', c.stalled),
    ('no_next_step', c.no_next_step), ('decision_month', c.decision_month), ('low_bmc', c.low_bmc)
  ) v(view, n);
end;
$$;

revoke all on function public.crm_lead_view_counts(text, text[], text, text, text, integer, text, uuid, text, text, text) from public, anon;
grant execute on function public.crm_lead_view_counts(text, text[], text, text, text, integer, text, uuid, text, text, text) to authenticated;
