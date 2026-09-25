-- Step: manual "estimated annual revenue" field on companies.
--
-- Neither Calgary Open Data nor Hunter.io provides company revenue, so this can't be
-- populated by the sync/enrichment pipeline -- it's filled in by a rep from the lead
-- detail page once they've researched a company, then used as a hard qualification
-- gate (see lib/leads/scoring.ts MIN_ANNUAL_REVENUE_TO_QUALIFY). Null/unknown is the
-- default and never penalizes a lead's score -- only a recorded figure below the
-- threshold disqualifies.
alter table public.companies
  add column if not exists estimated_annual_revenue numeric;
