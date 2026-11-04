-- Supabase grants new functions to `anon` by default, so "revoke from public" alone doesn't
-- remove signed-out access. Row-level security already kept these from returning data or
-- saving anything, and this adds the intended second layer. The two public registration
-- functions stay available to signed-out visitors on purpose.

revoke execute on function public.crm_filtered_leads(text, text, text, text, integer, text, uuid) from anon;
revoke execute on function public.crm_search_leads(text, text[], text, text, text, integer, text, uuid, text, boolean, integer, integer) from anon;
revoke execute on function public.crm_lead_stage_counts(text, text, text, text, integer, text, uuid) from anon;
revoke execute on function public.crm_lead_facets() from anon;
revoke execute on function public.import_budget(jsonb) from anon;
revoke execute on function public.budget_add_line(uuid, text, text, text, date) from anon;
revoke execute on function public.budget_add_month(uuid, date) from anon;
revoke execute on function public.budget_apply_event_plan(uuid) from anon;
