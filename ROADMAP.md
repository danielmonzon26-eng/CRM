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

1. ✅ **Project scaffold** — Next.js + TS + Tailwind app shell, Supabase client helpers, env
   template, `vercel.json`, project conventions.
2. ✅ **Database schema** — Supabase migrations: `companies`, `licenses` (raw source records),
   `leads` (qualified/working set), `contacts`, `activities`, `sync_runs`, `sources`. RLS policies
   for authenticated team members. *(this step)*
3. ✅ **Calgary Open Data ingestion** — SODA API client, `/api/cron/sync-sources` route,
   upsert logic, new-license detection. Field-name mapping confirmed live 2026-09-25 via
   `.github/workflows/verify-calgary-fields.yml` — every guessed field matched, plus a
   bonus `homeoccind` field now feeding the brick-and-mortar scoring signal (Step 4).
4. ✅ **Lead qualification/scoring** — rules engine to flag "new and growing": recent issue date,
   target NAICS/business-type match, license status, renewal/growth signals; writes qualified
   companies into `leads`. `TARGET_INDUSTRIES` set to Catapult Ready's real verticals
   (Manufacturing, Agriculture, E-commerce, Oil & Gas Service, Trades, Defence, Packaging);
   Brick and Mortar is scored separately via Calgary's real `homeoccind` field rather than a
   keyword guess. A manual `estimated_annual_revenue` field (migration 0004) is a **hard**
   $2M+ qualification gate — a company recorded below it is disqualified (score forced to 0)
   and, if already a lead, auto-moved to `unqualified` (never overriding `won`/`lost`) — see
   README.
5. ✅ **Contact enrichment pipeline** — Hunter.io domain/email search (name, title, email,
   confidence, phone/LinkedIn when Hunter has them), `/api/cron/enrich-leads` route. Web-search-
   assisted lookup (LinkedIn crawling, "About" pages) deferred — needs a search API key not yet
   provided; see README. *(this step)*
6. ✅ **CRM frontend** — leads pipeline board (New → Researching → Contacted → Qualified →
   Won/Lost), lead detail view with contacts + activity timeline, manual notes & status changes.
   No auth yet — see README security note. *(this step)*
7. ✅ **Auth & team roles** — Supabase Auth magic-link login, admin vs. rep roles (`profiles`
   table + RLS-enforced role checks), lead assignment, CRM data layer switched from
   service-role to session-scoped queries. Needs one-time Supabase dashboard config — see
   README. *(this step)*
8. ✅ **Additional source adapters** — pluggable `SourceAdapter` interface + registry;
   `/api/cron/sync-sources` runs every registered adapter through the same
   matching/scoring pipeline. Calgary refactored onto it as the first adapter; a
   Playwright-based template (serverless Chromium via `@sparticuz/chromium`) is ready
   to copy for the next JS-rendered target once one is named. *(this step)*
9. ✅ **Notifications & reporting** — in-app stats bar (total, new this week, contacted,
   qualified, won) on the pipeline board; daily email digest of newly-promoted leads via
   Resend (`/api/cron/daily-digest`, degrades to compute-only without `RESEND_API_KEY`).
   *(this step)*
10. ✅ **Deployment walkthrough** — go-live checklist covering Vercel env vars, Supabase
    Auth redirect URLs, verifying the deployed `/api/health`, bootstrap admin sign-in, and
    manually firing all four crons once before trusting the schedule. See README.
    *(this step — the dashboard actions themselves are one-time steps only you can
    perform; this session has no Vercel/Supabase dashboard access)*

Supabase project: `kteeooyybpwnnowkuwra` (see `supabase/config.toml`). Schema is applied and
verified live as of the `supabase-migrate.yml` GitHub Actions run on 2026-09-21 (uses the
Session pooler connection — the direct-connection host is IPv6-only and unreachable from
GitHub's runners).

All 10 steps are now built. `claude/calgary-business-leads-qgm9oy` is this repo's only
branch (and therefore its GitHub default branch), so it's almost certainly already
Vercel's Production Branch — confirm under Project → Settings → Git. Remaining work is
the one-time dashboard checklist in README.md, plus open follow-ups: the vocabulary used
inside `licencetypes` is still only seen for one example value (tighten
`TARGET_INDUSTRIES` keywords as real values show up), no second (JS-rendered) data
source has been named yet, and the daily digest still goes to every team member rather
than admins-only or by assignment.
