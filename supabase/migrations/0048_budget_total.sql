-- A budget's overall total: the money there is to allocate. Its lines are what's been
-- allocated from it, and spending is tracked against those. Empty until someone sets it.
-- Safe to re-run.

alter table public.budgets add column if not exists total_amount numeric(12, 2);

alter table public.budgets drop constraint if exists budgets_total_amount_check;
alter table public.budgets add constraint budgets_total_amount_check check (total_amount is null or total_amount >= 0);
