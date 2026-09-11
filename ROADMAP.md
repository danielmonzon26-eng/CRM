# Calgary Lead Engine — Build Roadmap

Purpose: identify new/growing Calgary businesses from public data sources, enrich them with
decision-maker contacts, and manage outreach through a purpose-built CRM — for Catapult Ready
program recruitment.

Stack decided:
- **Frontend/API**: Next.js 14 (App Router, TypeScript) on Vercel
- **Database/Auth**: Supabase (Postgres + Row Level Security + Auth)
- **Scheduling**: Vercel Cron (`vercel.json`) hitting internal API routes, protected by a cron secret
- **Primary data source**: Calgary Open Data "Business Licences" dataset via the Socrata Open Data
  API (SODA) — `https://data.calgary.ca/resource/vdjc-pybd.json` (no scraping needed, it's a real
  JSON API with `$where`/`$limit`/`$offset` query params)
- **JS-rendered source scraping**: Playwright, run from a Vercel cron route for light jobs, or as a
  separate worker if a site needs heavier interaction (evaluated per-source in Step 8)
- **Contact enrichment**: Hunter.io (Domain Search + Email Finder) for verified emails, plus web
  search to locate LinkedIn profiles/titles for named executives
- **Deploy**: GitHub → Vercel + Supabase integration (both already connected to this GitHub account)

Working agreement: we build and verify one step at a time. Each step ends with something runnable
or reviewable before the next step starts.

## Steps

1. **Project scaffold** — Next.js + TS + Tailwind app shell, Supabase client helpers, env template,
   `vercel.json`, project conventions. *(this step)*
2. **Database schema** — Supabase migrations: `companies`, `licenses` (raw source records),
   `leads` (qualified/working set), `contacts`, `activities`, `sync_runs`, `sources`. RLS policies
   for authenticated team members.
3. **Calgary Open Data ingestion** — SODA API client, `/api/cron/sync-calgary-licenses` route,
   upsert logic, new-license detection.
4. **Lead qualification/scoring** — rules engine to flag "new and growing": recent issue date,
   target NAICS/business-type match, license status, renewal/growth signals; writes qualified
   companies into `leads`.
5. **Contact enrichment pipeline** — Hunter.io domain/email search + web-search-assisted exec
   lookup (name, title, LinkedIn, email, phone confidence), `/api/cron/enrich-leads` route.
6. **CRM frontend** — leads pipeline board (New → Researching → Contacted → Qualified → Won/Lost),
   lead detail view with contacts + activity timeline, search/filter, manual notes & status changes.
7. **Auth & team roles** — Supabase Auth login, admin vs. rep roles, lead assignment.
8. **Additional source adapters** — pluggable adapter interface so new target sites (incl.
   JS-rendered ones needing Playwright) can be added without touching core pipeline code.
9. **Notifications & reporting** — daily digest (email or in-app) of new leads, basic dashboard
   stats (new this week, in pipeline, contacted, converted).
10. **Deployment walkthrough** — step-by-step: create Supabase project, run migrations, connect
    Vercel↔GitHub, set env vars/secrets, verify cron runs, go-live checklist.

We are starting Step 1 now.
