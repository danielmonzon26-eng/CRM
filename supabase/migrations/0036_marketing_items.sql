-- Marketing items on an event's budget: a cost with a marketing category (Creative,
-- Social, Online Advertising, Sponsorship, Advertising, Production), a description and
-- when it needs to be delivered: 1 week, 2 weeks or 1 month before the event, or a
-- custom date. They show in Marketing, and the delivery date follows the event if it
-- moves (only custom dates are stored). Safe to re-run.

alter table public.budget_items
  add column if not exists marketing_category text,
  add column if not exists delivery_timing text,
  add column if not exists delivery_on date,
  add column if not exists delivered_at timestamptz;

alter table public.budget_items drop constraint if exists budget_items_marketing_category_check;
alter table public.budget_items add constraint budget_items_marketing_category_check
  check (marketing_category is null or marketing_category in ('creative', 'social', 'online_advertising', 'sponsorship', 'advertising', 'production', 'event_materials', 'onsite_advertising', 'newsletter'));

alter table public.budget_items drop constraint if exists budget_items_delivery_timing_check;
alter table public.budget_items add constraint budget_items_delivery_timing_check
  check (delivery_timing is null or delivery_timing in ('1_week', '2_weeks', '1_month', 'custom'));

-- A custom timing needs its date; the others work theirs out from the event.
alter table public.budget_items drop constraint if exists budget_items_delivery_custom_check;
alter table public.budget_items add constraint budget_items_delivery_custom_check
  check (delivery_timing is distinct from 'custom' or delivery_on is not null);

create index if not exists budget_items_marketing_idx on public.budget_items (marketing_category) where marketing_category is not null;
