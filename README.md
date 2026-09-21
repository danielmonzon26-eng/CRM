# Calgary Lead Engine

Lead generation CRM: identifies new and growing Calgary businesses from public data sources,
enriches them with decision-maker contacts, and manages outreach — built for Catapult Ready
program recruitment.

See [ROADMAP.md](./ROADMAP.md) for the full step-by-step build plan and current status.

## Stack

- **Next.js 14** (App Router, TypeScript) — frontend + API routes, deployed on Vercel
- **Supabase** — Postgres database, Auth, Row Level Security
- **Vercel Cron** — daily jobs for data sync and contact enrichment
- **Tailwind CSS** — styling

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

Visit `http://localhost:3000` — you should see the build-progress page, and
`http://localhost:3000/api/health` should return `{ "ok": true, "supabase": "reachable" }` once
`.env.local` is filled in with a real Supabase project (schema not required yet at this step).

## Environment variables

See `.env.example` for the full list and where to find each value. Required for Step 1:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`CRON_SECRET`, `CALGARY_OPEN_DATA_APP_TOKEN`, and `HUNTER_API_KEY` are used starting in Steps 3–5.

## Project structure

```
app/                  Next.js App Router pages and API routes
  api/health/         Env + Supabase connectivity + schema check
lib/supabase/         Supabase client helpers (browser, server, admin/service-role)
supabase/migrations/  SQL migrations
supabase/config.toml  Links this repo to the Supabase project (for CLI / GitHub integration)
middleware.ts         Refreshes the Supabase auth session on every request
vercel.json           Cron job schedule (routes added in Steps 3 and 5)
```

## Applying database migrations

Three ways to get `supabase/migrations/*.sql` applied to the linked Supabase project:

1. **GitHub Actions (`.github/workflows/supabase-migrate.yml`)** — runs `psql` against every
   file in `supabase/migrations/` in order, using a repo secret. One-time setup: add a repository
   secret named `SUPABASE_DB_URL` (Settings → Secrets and variables → Actions → New repository
   secret) with the **Session pooler** connection string from Supabase's "Connect" dialog
   (Connection Method → Session pooler, NOT "Direct connection" — the direct-connection host is
   IPv6-only and GitHub-hosted runners can't reach it; you'll see `Network is unreachable` if you
   use it by mistake). It then runs automatically whenever `supabase/migrations/**` changes on
   `main` or this project's dev branch, or on demand via Actions → Apply Supabase migrations →
   Run workflow. Migrations are idempotent (`if not exists` / `on conflict do nothing`), so
   re-runs are safe. Verified working 2026-09-21.
2. **Supabase GitHub integration** — in the Supabase dashboard under Project Settings →
   Integrations → GitHub, connect this repository; Supabase then auto-applies migrations on its
   own when they land on the tracked branch.
3. **Manual, for immediate testing** — open the Supabase dashboard → SQL Editor, paste the
   contents of `supabase/migrations/0001_init_schema.sql`, run it, then do the same for
   `0002_seed_sources.sql`.

After applying, `/api/health` should return `"schema": "applied"`.

## Data source adapters (Steps 3 & 8)

`app/api/cron/sync-sources/route.ts` is a single generic ingestion route that runs
every adapter registered in `lib/sources/registry.ts` against records from the last
`?days=N` (default 7), upserting into `licenses` + `companies` through the same
matching pipeline regardless of source. It's wired into `vercel.json` to run daily and
requires `CRON_SECRET` (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
automatically). `?source=<key>` runs just one adapter, useful when testing a new one.

**Adding a new source is a two-step, no-core-changes process:**
1. Implement `SourceAdapter` (`lib/sources/types.ts`) — `fetchSince(sinceDate)` returns
   `NormalizedRecord[]`. See `lib/sources/calgary.ts` for a plain-`fetch` open-data-API
   example, or copy `lib/sources/template-playwright-adapter.ts` for a JS-rendered site
   (uses headless Chromium via Playwright — see below).
2. Add it to the `SOURCE_ADAPTERS` array in `lib/sources/registry.ts`.

The sync route auto-creates the `sources` table row from the adapter's own
`key`/`name`/`kind` — no migration needed per new source.

### Calgary Business Licences (the first adapter)

`lib/sources/calgary.ts` pulls recently-issued licenses from `data.calgary.ca`'s SODA
API.

**Field mapping needs a one-time live check.** The column names in
`lib/sources/calgary.ts` (`getbusid`, `tradename`, `first_iss_dt`, etc.) come from the
dataset's published column list, not a live API response — this was built in a sandbox
that can't reach `data.calgary.ca`. Before trusting the daily sync in production, run:

```bash
curl "https://data.calgary.ca/resource/vdjc-pybd.json?\$limit=1"
```

and compare the JSON keys against `CANDIDATE_FIELDS` in that file. If anything differs,
add the real key as another candidate (or reorder) — no data is lost either way, since
the full raw record is always stored in `licenses.raw`, but a wrong guess means a
derived column (like `issue_date`) stays null until fixed.

Manually trigger a sync once deployed (or locally with `CRON_SECRET` set) — omit
`source` to run every registered adapter:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-deployment>/api/cron/sync-sources?days=7&source=calgary_business_licenses"
```

### Adding a JS-rendered source with Playwright

`lib/sources/browser.ts` launches a serverless-compatible headless Chromium
(`@sparticuz/chromium` + `playwright-core`) for adapters that need to render JS rather
than call a plain API. `lib/sources/template-playwright-adapter.ts` is a copy-paste
starting point — it's not registered, so it does nothing until you point it at a real
target and add it to the registry. Before scraping any specific site, check its Terms
of Service and `/robots.txt`; some sites (LinkedIn is a common example) explicitly
prohibit automated scraping regardless of technical feasibility.

Notes for when you build one:
- Test locally by setting `PLAYWRIGHT_EXECUTABLE_PATH` to a local Chromium (from `npx
  playwright install chromium`) — `@sparticuz/chromium`'s binary is Linux-only, built
  for the Vercel/Lambda runtime.
- The Chromium binary is large (~50MB+); if a Vercel function size limit is hit,
  `@sparticuz/chromium-min` plus externally-hosted binaries is the documented fallback
  (see the [package README](https://github.com/Sparticuz/chromium)) — not implemented
  here since it's only needed if/when that limit is actually hit.
- A slow-to-render target may need a longer `maxDuration` than the 60s used elsewhere,
  which requires a paid Vercel plan past the Hobby tier's cap.

## Lead scoring (Step 4)

`app/api/cron/score-leads/route.ts` scores every company from its license history and
promotes anything crossing `MIN_SCORE_TO_QUALIFY` into the `leads` working set. Re-running
it never resets a lead's pipeline `status` — only `score`/`score_reasons` refresh on an
existing lead.

**Customize `TARGET_INDUSTRIES` in `lib/leads/scoring.ts`** — it ships with a generic
placeholder list (technology, consulting, marketing, etc.) since this was built without
knowing Catapult Ready's actual program focus. Edit that array (or empty it to score all
industries equally) to match your real target verticals.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-deployment>/api/cron/score-leads"
```

## Contact enrichment (Step 5)

`app/api/cron/enrich-leads/route.ts` finds decision-maker contacts (CEO/owner first, then
business development, then marketing, then other management — see
`lib/enrichment/rank.ts`) for any lead without contacts yet, via Hunter.io's Domain Search
API. Requires `HUNTER_API_KEY` (sign up at hunter.io; the free tier includes a small
monthly search allowance, enough to test with before deciding on a paid plan).

Since Calgary's license data doesn't include a website, this passes the company **name**
to Hunter (its Domain Search API accepts a bare company name and resolves the domain
itself) — once resolved, the domain is saved back onto the company so future runs skip
straight to it.

**This is Hunter.io only, not full open-web search.** Hunter's own database only covers
companies with an existing indexed email footprint, so brand-new or very small
businesses often come back empty — that's expected and gets logged as an activity on the
lead, not treated as an error. To go further (crawl a company's "About/Team" page,
search LinkedIn directly), you'd add a second provider — that needs its own API key
(Google Programmable Search, Bing Web Search, or SerpAPI are the common choices) which
this project doesn't have yet. `lib/enrichment/hunter.ts` and `rank.ts` are written so a
second provider can slot in alongside Hunter rather than replacing it.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-deployment>/api/cron/enrich-leads?limit=20"
```

## Auth & team roles (Step 7)

Real login via Supabase Auth magic links, replacing the no-auth gap from Step 6. A
`profiles` table (role: `admin` | `rep`) is auto-created per signup by a database
trigger; RLS enforces that only admins can change roles (`/team` page), not just the UI.
All CRM reads/writes now go through the session-scoped client
(`lib/supabase/server.ts`), so RLS actually governs access — the service-role client is
used only by the cron routes now.

**One-time Supabase dashboard setup required for login to work at all:**
1. Authentication → URL Configuration → add `<your-site-url>/auth/callback` to the
   **Redirect URLs** allowlist (both `http://localhost:3000/auth/callback` for local dev
   and your production URL) — magic links fail with a redirect error otherwise.
2. Set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) in production so magic-link emails
   point at the right domain regardless of how the request arrived.

**Bootstrap admin:** `supabase/migrations/0003_auth_profiles.sql` hardcodes
`daniel.monzon26@gmail.com` (pulled from this session's account context) as the one
email that becomes `admin` automatically on first sign-in — everyone else defaults to
`rep`. Edit that email in the migration if you want to sign in as admin with a
different address, or just promote further admins from the `/team` page once you have
one working admin account.

**Email delivery:** magic links send through Supabase's built-in email service by
default, which is rate-limited on the free tier and can land in spam. Configure a
custom SMTP provider under Authentication → Emails once you're onboarding a real team.

## CRM frontend (Step 6)

`/` is the pipeline board (columns: New, Researching, Contacted, Qualified, Won, Lost,
Unqualified) — each card shows the score, primary contact, and a status dropdown that
updates immediately. `/leads/[id]` is the detail view: full score breakdown, all
contacts found, an assignee picker, and an activity timeline with a note box. All of it
now sits behind the Step 7 login — see below.

