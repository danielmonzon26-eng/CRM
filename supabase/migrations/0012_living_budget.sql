-- Makes budgets editable in the app. Totals are kept correct here in the database, not in
-- screen code, and every change is recorded in budget_changes. Existing budget data is kept.
--
-- The rules:
--   General line: its total is the sum of its months.
--   Event line: its total is the sum of its items, all planned in the line's plan_month.
--   A linked event's budget_amount follows its line.
--   A line with expenses can't be deleted, so spending can't vanish with it.

alter table public.budget_lines add column if not exists plan_month date;

update public.budget_lines l
set plan_month = (
  select a.month from public.budget_allocations a
  where a.line_id = l.id
  order by a.amount desc, a.month
  limit 1
)
where l.kind = 'event' and l.plan_month is null;

-- Append-only: team members can read and add, but nobody can edit or remove history. There's
-- deliberately no foreign key to budgets or lines, so history outlives what it describes.
create table if not exists public.budget_changes (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid,
  line_id uuid,
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists budget_changes_budget_idx on public.budget_changes (budget_id, changed_at desc);
create index if not exists budget_changes_line_idx on public.budget_changes (line_id, changed_at desc);

alter table public.budget_changes enable row level security;

drop policy if exists "authenticated read budget_changes" on public.budget_changes;
create policy "authenticated read budget_changes" on public.budget_changes
  for select to authenticated using (true);

drop policy if exists "authenticated add budget_changes" on public.budget_changes;
create policy "authenticated add budget_changes" on public.budget_changes
  for insert to authenticated with check (true);

create or replace function public.log_budget_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_line_id uuid;
  v_budget_id uuid;
begin
  if tg_table_name = 'budget_lines' then
    v_line_id := (v_row->>'id')::uuid;
    v_budget_id := (v_row->>'budget_id')::uuid;
  else
    v_line_id := (v_row->>'line_id')::uuid;
    select l.budget_id into v_budget_id from public.budget_lines l where l.id = v_line_id;
    -- The line is being deleted, and that delete is already recorded.
    if v_budget_id is null then
      return null;
    end if;
  end if;

  insert into public.budget_changes (budget_id, line_id, table_name, action, before_data, after_data, changed_by)
  values (
    v_budget_id, v_line_id, tg_table_name, lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    (select auth.uid())
  );
  return null;
end;
$$;

-- A general line's total follows its months.
create or replace function public.budget_sync_general_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line_id uuid := coalesce(new.line_id, old.line_id);
begin
  update public.budget_lines l
  set amount = coalesce((select sum(a.amount) from public.budget_allocations a where a.line_id = v_line_id), 0)
  where l.id = v_line_id and l.kind = 'general';
  return null;
end;
$$;

-- Puts an event line's whole total in its plan month and zero everywhere else.
create or replace function public.budget_apply_event_plan(p_line_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_line public.budget_lines%rowtype;
  v_month date;
begin
  select * into v_line from public.budget_lines where id = p_line_id;
  if not found then
    return;
  end if;

  v_month := coalesce(
    v_line.plan_month,
    (select a.month from public.budget_allocations a where a.line_id = p_line_id order by a.amount desc, a.month limit 1)
  );
  if v_month is null then
    return;
  end if;

  update public.budget_allocations
  set amount = case when month = v_month then v_line.amount else 0 end
  where line_id = p_line_id
    and amount is distinct from (case when month = v_month then v_line.amount else 0 end);

  insert into public.budget_allocations (line_id, month, amount)
  values (p_line_id, v_month, v_line.amount)
  on conflict (line_id, month) do nothing;

  if v_line.plan_month is distinct from v_month then
    update public.budget_lines set plan_month = v_month where id = p_line_id;
  end if;
end;
$$;

-- An event line's total follows its items.
create or replace function public.budget_sync_event_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line_id uuid := coalesce(new.line_id, old.line_id);
begin
  update public.budget_lines l
  set amount = coalesce((select sum(i.amount) from public.budget_items i where i.line_id = v_line_id), 0)
  where l.id = v_line_id and l.kind = 'event';
  perform public.budget_apply_event_plan(v_line_id);
  return null;
end;
$$;

-- Moving an event line's plan month moves its money. A linked event's amount follows too.
create or replace function public.budget_line_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'event' and new.plan_month is distinct from old.plan_month and old.plan_month is not null then
    perform public.budget_apply_event_plan(new.id);
  end if;
  if new.event_id is not null and (new.amount is distinct from old.amount or new.event_id is distinct from old.event_id) then
    update public.events set budget_amount = new.amount where id = new.event_id;
  end if;
  return null;
end;
$$;

create or replace function public.budget_protect_spent_line()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.budget_expenses e where e.line_id = old.id) then
    raise exception 'This line has expenses. Delete or move them first.' using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists budget_protect_spent_line on public.budget_lines;
create trigger budget_protect_spent_line before delete on public.budget_lines
  for each row execute function public.budget_protect_spent_line();

drop trigger if exists budget_line_changed on public.budget_lines;
create trigger budget_line_changed after update on public.budget_lines
  for each row execute function public.budget_line_changed();

drop trigger if exists budget_sync_general_total on public.budget_allocations;
create trigger budget_sync_general_total after insert or update or delete on public.budget_allocations
  for each row execute function public.budget_sync_general_total();

drop trigger if exists budget_sync_event_total on public.budget_items;
create trigger budget_sync_event_total after insert or update or delete on public.budget_items
  for each row execute function public.budget_sync_event_total();

do $$
declare
  t text;
begin
  foreach t in array array['budget_lines', 'budget_allocations', 'budget_items', 'budget_expenses'] loop
    execute format('drop trigger if exists log_budget_change on public.%I', t);
    execute format('create trigger log_budget_change after insert or update or delete on public.%I for each row execute function public.log_budget_change()', t);
  end loop;
end $$;

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
  select distinct v_line_id, a.month, 0::numeric
  from public.budget_allocations a
  join public.budget_lines l on l.id = a.line_id
  where l.budget_id = p_budget_id;

  return v_line_id;
end;
$$;

-- Extends a budget by one month: a zero row on every line, and an updated period label.
create or replace function public.budget_add_month(p_budget_id uuid, p_month date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
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

  select min(a.month), max(a.month), count(distinct a.month)
  into v_first, v_last, v_count
  from public.budget_allocations a
  join public.budget_lines l on l.id = a.line_id
  where l.budget_id = p_budget_id;

  update public.budgets
  set period_label = to_char(v_first, 'Mon YYYY') || ' – ' || to_char(v_last, 'Mon YYYY') || ' (' || v_count || ' months)'
  where id = p_budget_id;
end;
$$;

revoke all on function public.budget_apply_event_plan(uuid) from public;
revoke all on function public.budget_add_line(uuid, text, text, text, date) from public;
revoke all on function public.budget_add_month(uuid, date) from public;
grant execute on function public.budget_apply_event_plan(uuid) to authenticated;
grant execute on function public.budget_add_line(uuid, text, text, text, date) to authenticated;
grant execute on function public.budget_add_month(uuid, date) to authenticated;
