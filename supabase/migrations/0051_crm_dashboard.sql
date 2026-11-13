-- The CRM dashboard's counts in one call: leads by stage, new leads, contacts and
-- companies, and contacts by their company's industry. Runs as the caller, so the usual
-- permissions apply. Safe to re-run.

create or replace function public.crm_dashboard()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'leads_by_status', (
      select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      from (select l.status::text as status, count(*) as n from public.leads l group by l.status) s
    ),
    'new_leads_30d', (select count(*) from public.leads l where l.created_at > now() - interval '30 days'),
    'contacts', (select count(*) from public.contacts),
    'companies', (select count(*) from public.companies),
    'contacts_by_industry', (
      select coalesce(jsonb_agg(jsonb_build_object('industry', t.industry, 'count', t.n) order by t.n desc, t.industry), '[]'::jsonb)
      from (
        select coalesce(nullif(btrim(co.industry), ''), 'Not set') as industry, count(*) as n
        from public.contacts c
        join public.leads l on l.id = c.lead_id
        join public.companies co on co.id = l.company_id
        group by 1
      ) t
    )
  );
$$;

revoke all on function public.crm_dashboard() from public, anon;
grant execute on function public.crm_dashboard() to authenticated;
