-- Lets a budget be built in the app by name before it has any lines, and tracks its revenue. Its months used to come only from
-- its lines' monthly rows, so a new, empty budget had no months at all. A start and end month
-- on the budget hold its period until lines exist. Existing budgets are unchanged: both stay
-- empty on them, and their months still come from their lines.

alter table public.budgets
  add column if not exists start_month date,
  add column if not exists end_month date;

alter table public.budgets drop constraint if exists budgets_period_check;
alter table public.budgets add constraint budgets_period_check check (
  (start_month is null or extract(day from start_month) = 1)
  and (end_month is null or extract(day from end_month) = 1)
  and (start_month is null or end_month is null or start_month <= end_month)
);

-- Adds a line with a row for every month in the budget, in one transaction.
create or replace function public.budget_add_line(
  p_budget_id uuid,
  p_kind text,
  p_section text,
  p_name text,
  p_plan_month date default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_line_id uuid;
begin
  insert into public.budget_lines (budget_id, kind, section, name, plan_month, sort_order)
  values (
    p_budget_id, p_kind, p_section, p_name, case when p_kind = 'event' then p_plan_month end,
    coalesce((select max(l.sort_order) from public.budget_lines l where l.budget_id = p_budget_id), 0) + 1
  )
  returning id into v_line_id;

  insert into public.budget_allocations (line_id, month, amount)
  select v_line_id, m.month, 0::numeric
  from (
    select a.month
    from public.budget_allocations a
    join public.budget_lines l on l.id = a.line_id
    where l.budget_id = p_budget_id and a.line_id <> v_line_id
    union
    select s.month::date
    from public.budgets b
    cross join lateral generate_series(b.start_month, b.end_month, interval '1 month') as s(month)
    where b.id = p_budget_id
  ) m;

  return v_line_id;
end;
$$;

-- Extends a budget by one month: a zero row on every line, and an updated period.
create or replace function public.budget_add_month(p_budget_id uuid, p_month date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
  v_first date;
  v_last date;
  v_count integer;
begin
  if extract(day from p_month) <> 1 then
    raise exception 'A budget month must be the first of the month.' using errcode = '22023';
  end if;

  insert into public.budget_allocations (line_id, month, amount)
  select l.id, p_month, 0 from public.budget_lines l where l.budget_id = p_budget_id
  on conflict (line_id, month) do nothing;

  select b.start_month, b.end_month into v_start, v_end from public.budgets b where b.id = p_budget_id;

  -- A period set on the budget grows with it, and stays empty on budgets that never had one.
  if v_start is not null then
    v_start := least(v_start, p_month);
    v_end := greatest(v_end, p_month);
  end if;

  select min(m.month), max(m.month), count(*)
  into v_first, v_last, v_count
  from (
    select a.month
    from public.budget_allocations a
    join public.budget_lines l on l.id = a.line_id
    where l.budget_id = p_budget_id
    union
    select s.month::date from generate_series(v_start, v_end, interval '1 month') as s(month)
  ) m;

  update public.budgets
  set start_month = v_start,
      end_month = v_end,
      period_label = to_char(v_first, 'Mon YYYY') || ' – ' || to_char(v_last, 'Mon YYYY') || ' (' || v_count || ' months)'
  where id = p_budget_id;
end;
$$;

-- Adds several months in one transaction, so a failure can't leave part of a quarter behind.
create or replace function public.budget_add_months(p_budget_id uuid, p_months date[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_month date;
begin
  foreach v_month in array p_months loop
    perform public.budget_add_month(p_budget_id, v_month);
  end loop;
end;
$$;

revoke all on function public.budget_add_months(uuid, date[]) from public, anon;
grant execute on function public.budget_add_months(uuid, date[]) to authenticated;

-- Grants, sponsorships, and other money coming in, tracked on a budget. Won proposals and event
-- revenue already have their own records, so they aren't entered here and aren't counted twice.
create table if not exists public.budget_revenue (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  kind text not null check (kind in ('grant', 'sponsorship', 'other')),
  source text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'received', 'declined')),
  expected_on date not null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budget_revenue_budget_id_idx on public.budget_revenue (budget_id, expected_on);

drop trigger if exists set_updated_at on public.budget_revenue;
create trigger set_updated_at before update on public.budget_revenue
  for each row execute function public.set_updated_at();

alter table public.budget_revenue enable row level security;

drop policy if exists "authenticated all budget_revenue" on public.budget_revenue;
create policy "authenticated all budget_revenue" on public.budget_revenue
  for all to authenticated using (true) with check (true);

revoke all on table public.budget_revenue from anon;
