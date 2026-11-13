-- Paid promotion for events: boosting a post or running an ad, planned against the ad
-- budget on the event's Budget tab (costs named like Ad spend, Ads, Boost, Paid social).
-- The app suggests a plan from that budget; saving it (or adding one by hand) creates
-- rows here, which the team then edits and moves through Planned -> Running -> Done,
-- recording what was spent. Safe to re-run.

create table if not exists public.marketing_promotions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  post_id uuid references public.social_posts (id) on delete set null,
  kind text not null default 'boost' check (kind in ('boost', 'ad')),
  name text not null check (btrim(name) <> ''),
  platforms text[] not null default '{}' check (platforms <@ array['linkedin', 'facebook', 'instagram']),
  starts_on date not null,
  ends_on date not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  spent numeric(12, 2) not null default 0 check (spent >= 0),
  status text not null default 'planned' check (status in ('planned', 'running', 'done')),
  suggested boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_promotions_dates check (ends_on >= starts_on)
);

create index if not exists marketing_promotions_event_idx on public.marketing_promotions (event_id);
create index if not exists marketing_promotions_dates_idx on public.marketing_promotions (starts_on, ends_on);
create index if not exists marketing_promotions_post_idx on public.marketing_promotions (post_id);

drop trigger if exists marketing_promotions_set_updated_at on public.marketing_promotions;
create trigger marketing_promotions_set_updated_at before update on public.marketing_promotions
  for each row execute function public.set_updated_at();

alter table public.marketing_promotions enable row level security;
drop policy if exists "team manage promotions" on public.marketing_promotions;
create policy "team manage promotions" on public.marketing_promotions
  for all to authenticated using (true) with check (true);
revoke all on public.marketing_promotions from anon;
grant select, insert, update, delete on public.marketing_promotions to authenticated;
