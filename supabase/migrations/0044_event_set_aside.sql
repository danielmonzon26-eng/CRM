-- The amount the budget sets aside for an event, separate from the total of the event's
-- costs (which an event line's amount already follows). The event page compares the two:
-- set aside, costs planned, spent, and what's left. Null means no amount set yet.
-- Safe to re-run.

alter table public.budget_lines
  add column if not exists planned_amount numeric(12, 2) check (planned_amount is null or planned_amount >= 0);
