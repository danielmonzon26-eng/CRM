-- Budgets, matching the structure of the marketing budget workbook: a budget has lines,
-- each line has a monthly plan, and an event line has its own items (paid ads, marketing,
-- photo and video). Actuals come from individual expenses, so every total can be traced.
-- Also adds manual revenue entries for event reporting. All tables are new.

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_label text,
  source_file text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, period_label)
);

create table if not exists public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets (id) on delete cascade,
  kind text not null check (kind in ('general', 'event')),
  section text not null,
  name text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  event_id uuid unique references public.events (id) on delete set null,
  owner_name text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_allocations (
  line_id uuid not null references public.budget_lines (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  primary key (line_id, month)
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.budget_lines (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  notes text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.budget_lines (id) on delete cascade,
  item_id uuid references public.budget_items (id) on delete set null,
  status text not null default 'actual' check (status in ('committed', 'actual')),
  amount numeric(12, 2) not null check (amount >= 0),
  incurred_on date not null,
  vendor text,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_revenue (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  source text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  received_on date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists budget_lines_budget_id_idx on public.budget_lines (budget_id);
create index if not exists budget_items_line_id_idx on public.budget_items (line_id);
create index if not exists budget_expenses_line_id_idx on public.budget_expenses (line_id);
create index if not exists budget_expenses_item_id_idx on public.budget_expenses (item_id);
create index if not exists event_revenue_event_id_idx on public.event_revenue (event_id);

do $$
declare
  t text;
begin
  foreach t in array array['budgets', 'budget_lines', 'budget_items', 'budget_expenses', 'event_revenue'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
  foreach t in array array['budgets', 'budget_lines', 'budget_allocations', 'budget_items', 'budget_expenses', 'event_revenue'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'authenticated all ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'authenticated all ' || t, t);
  end loop;
end $$;

-- Saves a parsed workbook in one transaction, so a failed import leaves nothing behind.
-- Runs with the caller's rights, so the policies above still apply.
create or replace function public.import_budget(p_budget jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_budget_id uuid;
  v_line jsonb;
  v_line_id uuid;
  v_month jsonb;
  v_item jsonb;
  v_item_id uuid;
  v_line_order integer := 0;
  v_item_order integer;
begin
  insert into public.budgets (name, period_label, source_file, notes, created_by)
  values (
    p_budget->>'name', p_budget->>'periodLabel', p_budget->>'sourceFile', p_budget->>'notes',
    (select auth.uid())
  )
  returning id into v_budget_id;

  for v_line in select * from jsonb_array_elements(p_budget->'lines') loop
    v_line_order := v_line_order + 1;
    insert into public.budget_lines (budget_id, kind, section, name, amount, owner_name, notes, sort_order)
    values (
      v_budget_id, v_line->>'kind', v_line->>'section', v_line->>'name',
      (v_line->>'amount')::numeric, v_line->>'ownerName', v_line->>'notes', v_line_order
    )
    returning id into v_line_id;

    for v_month in select * from jsonb_array_elements(v_line->'months') loop
      insert into public.budget_allocations (line_id, month, amount)
      values (v_line_id, (v_month->>'month')::date, (v_month->>'amount')::numeric);
    end loop;

    v_item_order := 0;
    for v_item in select * from jsonb_array_elements(coalesce(v_line->'items', '[]'::jsonb)) loop
      v_item_order := v_item_order + 1;
      insert into public.budget_items (line_id, name, amount, notes, sort_order)
      values (v_line_id, v_item->>'name', (v_item->>'amount')::numeric, v_item->>'notes', v_item_order)
      returning id into v_item_id;

      if (v_item->>'actual') is not null then
        insert into public.budget_expenses (line_id, item_id, status, amount, incurred_on, description, created_by)
        values (
          v_line_id, v_item_id, 'actual', (v_item->>'actual')::numeric,
          (p_budget->>'importedOn')::date, 'Actual imported from the workbook', (select auth.uid())
        );
      end if;
    end loop;

    if (v_line->>'actual') is not null then
      insert into public.budget_expenses (line_id, status, amount, incurred_on, description, created_by)
      values (
        v_line_id, 'actual', (v_line->>'actual')::numeric,
        (p_budget->>'importedOn')::date, 'Actual imported from the workbook', (select auth.uid())
      );
    end if;
  end loop;

  return v_budget_id;
end;
$$;

revoke all on function public.import_budget(jsonb) from public;
grant execute on function public.import_budget(jsonb) to authenticated;
