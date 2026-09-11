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
  api/health/         Env + Supabase connectivity check
lib/supabase/         Supabase client helpers (browser, server, admin/service-role)
supabase/migrations/  SQL migrations (added in Step 2)
middleware.ts         Refreshes the Supabase auth session on every request
vercel.json           Cron job schedule (routes added in Steps 3 and 5)
```

## Note on `vercel.json` crons

The cron paths in `vercel.json` (`/api/cron/sync-calgary-licenses`, `/api/cron/enrich-leads`) don't
exist yet — they're built in Steps 3 and 5. Until then, if this is deployed to Vercel, those crons
will just hit a 404 harmlessly once a day.
