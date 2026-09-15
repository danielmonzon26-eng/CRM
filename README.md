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
   secret) with the connection string from Supabase dashboard → Project Settings → Database →
   Connection string → URI (prefer the direct connection over the transaction pooler, since this
   runs multi-statement files). It then runs automatically whenever `supabase/migrations/**`
   changes on `main` or this project's dev branch, or on demand via Actions → Apply Supabase
   migrations → Run workflow. Migrations are idempotent (`if not exists` / `on conflict do
   nothing`), so re-runs are safe.
2. **Supabase GitHub integration** — in the Supabase dashboard under Project Settings →
   Integrations → GitHub, connect this repository; Supabase then auto-applies migrations on its
   own when they land on the tracked branch.
3. **Manual, for immediate testing** — open the Supabase dashboard → SQL Editor, paste the
   contents of `supabase/migrations/0001_init_schema.sql`, run it, then do the same for
   `0002_seed_sources.sql`.

After applying, `/api/health` should return `"schema": "applied"`.

## Calgary Open Data ingestion (Step 3)

`app/api/cron/sync-calgary-licenses/route.ts` pulls recently-issued licenses from
`data.calgary.ca` and upserts them into `licenses` + `companies`. It's wired into
`vercel.json` to run daily and requires `CRON_SECRET` to be set (Vercel Cron sends
`Authorization: Bearer $CRON_SECRET` automatically).

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

Manually trigger a sync once deployed (or locally with `CRON_SECRET` set):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-deployment>/api/cron/sync-calgary-licenses?days=7"
```

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

## CRM frontend (Step 6)

`/` is the pipeline board (columns: New, Researching, Contacted, Qualified, Won, Lost,
Unqualified) — each card shows the score, primary contact, and a status dropdown that
updates immediately. `/leads/[id]` is the detail view: full score breakdown, all
contacts found, and an activity timeline with a note box.

**⚠️ No access control yet.** These pages and their Server Actions currently read/write
through the service-role Supabase client directly (not a signed-in user's session),
because RLS denies the `anon` role entirely and there's no login yet (that's Step 7).
Practically: **anyone who can reach the deployed URL can view and edit every lead** —
don't share the Vercel URL publicly, and consider turning on [Vercel Deployment
Protection](https://vercel.com/docs/deployment-protection) (password or SSO) until Step
7 ships real authentication.

## Note on `vercel.json` crons

The cron paths in `vercel.json` (`/api/cron/sync-calgary-licenses`, `/api/cron/enrich-leads`) don't
exist yet — they're built in Steps 3 and 5. Until then, if this is deployed to Vercel, those crons
will just hit a 404 harmlessly once a day.
