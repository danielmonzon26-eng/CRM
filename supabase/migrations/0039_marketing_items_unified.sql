-- One list of marketing items for the whole planner. Each item belongs to a stream:
-- Catapult (general marketing), Event (an event's own marketing) or Sponsorship (for a
-- sponsor company, optionally at an event), and has a type: Social, Online Advertising,
-- Production or Creative. An item can be paid from a budget line: it then keeps a
-- matching cost on that line, so Budgets, the event's Budget tab and Marketing all show
-- the same thing. Changing that cost under Budgets updates the item; deleting it unlinks.
-- Existing marketing costs from event budgets (0036) become items once. Safe to re-run.

create table if not exists public.marketing_items (
  id uuid primary key default gen_random_uuid(),
  stream text not null check (stream in ('catapult', 'event', 'sponsorship')),
  item_type text not null check (item_type in ('social', 'online_advertising', 'production', 'creative', 'event_materials', 'onsite_advertising')),
  description text not null default '',
  event_id uuid references public.events (id) on delete set null,
  sponsor_company_id uuid references public.companies (id) on delete set null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  budget_line_id uuid references public.budget_lines (id) on delete set null,
  budget_item_id uuid unique references public.budget_items (id) on delete set null,
  delivery_timing text check (delivery_timing is null or delivery_timing in ('1_week', '2_weeks', '1_month', 'custom')),
  delivery_on date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_items_custom_date check (delivery_timing is distinct from 'custom' or delivery_on is not null)
);

create index if not exists marketing_items_event_idx on public.marketing_items (event_id);
create index if not exists marketing_items_line_idx on public.marketing_items (budget_line_id);
create index if not exists marketing_items_sponsor_idx on public.marketing_items (sponsor_company_id);

drop trigger if exists marketing_items_set_updated_at on public.marketing_items;
create trigger marketing_items_set_updated_at before update on public.marketing_items
  for each row execute function public.set_updated_at();

alter table public.marketing_items enable row level security;
drop policy if exists "team manage marketing items" on public.marketing_items;
create policy "team manage marketing items" on public.marketing_items for all to authenticated using (true) with check (true);
revoke all on public.marketing_items from anon;
grant select, insert, update, delete on public.marketing_items to authenticated;

-- The 0036 categories that aren't types any more read as their nearest type.
alter table public.budget_items drop constraint if exists budget_items_marketing_category_check;
alter table public.budget_items add constraint budget_items_marketing_category_check
  check (marketing_category is null or marketing_category in ('creative', 'social', 'online_advertising', 'sponsorship', 'advertising', 'production', 'event_materials', 'onsite_advertising'));

create or replace function public.marketing_item_label(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case p_type when 'social' then 'Social' when 'online_advertising' then 'Online Advertising' when 'production' then 'Production' else 'Creative' end;
$$;

-- Item -> its cost on the budget line. pg_trigger_depth stops the two triggers chasing each other.
create or replace function public.marketing_items_sync_budget()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item uuid;
  v_name text;
begin
  -- The cost was deleted under Budgets (the foreign key cleared it): unlink the item.
  if tg_op = 'UPDATE' and old.budget_item_id is not null and new.budget_item_id is null
     and new.budget_line_id is not distinct from old.budget_line_id then
    new.budget_line_id := null;
    return new;
  end if;

  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.budget_item_id is not null then
      delete from public.budget_items where id = old.budget_item_id;
    end if;
    return old;
  end if;

  v_name := left(coalesce(nullif(btrim(new.description), ''), public.marketing_item_label(new.item_type)), 200);

  -- Moved to another line, or unlinked: the old cost goes.
  if tg_op = 'UPDATE' and old.budget_item_id is not null and new.budget_line_id is distinct from old.budget_line_id then
    delete from public.budget_items where id = old.budget_item_id;
    new.budget_item_id := null;
  end if;

  if new.budget_line_id is null then
    new.budget_item_id := null;
    return new;
  end if;

  if new.budget_item_id is not null then
    update public.budget_items
    set name = v_name, amount = new.amount, marketing_category = new.item_type,
        delivery_timing = new.delivery_timing, delivery_on = new.delivery_on,
        delivered_at = case when new.status = 'done' then coalesce(delivered_at, now()) else null end
    where id = new.budget_item_id;
    if found then
      return new;
    end if;
  end if;

  insert into public.budget_items (line_id, name, amount, marketing_category, delivery_timing, delivery_on, delivered_at, sort_order)
  values (
    new.budget_line_id, v_name, new.amount, new.item_type, new.delivery_timing, new.delivery_on,
    case when new.status = 'done' then now() end,
    coalesce((select max(sort_order) from public.budget_items where line_id = new.budget_line_id), 0) + 1
  )
  returning id into v_item;
  new.budget_item_id := v_item;
  return new;
end;
$$;

drop trigger if exists marketing_items_sync_budget on public.marketing_items;
create trigger marketing_items_sync_budget before insert or update on public.marketing_items
  for each row execute function public.marketing_items_sync_budget();
drop trigger if exists marketing_items_sync_budget_delete on public.marketing_items;
create trigger marketing_items_sync_budget_delete after delete on public.marketing_items
  for each row execute function public.marketing_items_sync_budget();

-- Cost changed under Budgets -> the item follows.
create or replace function public.budget_items_sync_marketing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  update public.marketing_items
  set amount = new.amount,
      description = case when new.name = public.marketing_item_label(item_type) then '' else new.name end
  where budget_item_id = new.id
    and (amount is distinct from new.amount or coalesce(nullif(description, ''), public.marketing_item_label(item_type)) is distinct from new.name);
  return new;
end;
$$;

drop trigger if exists budget_items_sync_marketing on public.budget_items;
create trigger budget_items_sync_marketing after update of name, amount on public.budget_items
  for each row execute function public.budget_items_sync_marketing();

-- Marketing costs already on event budgets become items, once.
do $$
begin
  if not exists (select 1 from public.migration_markers where key = '0039_marketing_items_backfill') then
    insert into public.marketing_items (stream, item_type, description, event_id, amount, budget_line_id, budget_item_id, delivery_timing, delivery_on, status)
    select
      case when bi.marketing_category = 'sponsorship' then 'sponsorship' else 'event' end,
      case bi.marketing_category when 'advertising' then 'online_advertising' when 'sponsorship' then 'creative' else bi.marketing_category end,
      bi.name, bl.event_id, bi.amount, bi.line_id, bi.id, bi.delivery_timing, bi.delivery_on,
      case when bi.delivered_at is not null then 'done' else 'planned' end
    from public.budget_items bi
    join public.budget_lines bl on bl.id = bi.line_id
    where bi.marketing_category is not null
      and not exists (select 1 from public.marketing_items mi where mi.budget_item_id = bi.id);
    insert into public.migration_markers (key) values ('0039_marketing_items_backfill');
  end if;
end;
$$;
