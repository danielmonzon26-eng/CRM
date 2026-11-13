-- Moving an event to another budget line, from the event's Budget tab. The event's costs,
-- marketing items and spending go with it in one step; the old line stays in its budget,
-- empty. Safe to re-run.

-- A cost moved to another line: both lines' totals follow (before, only the new one did).
create or replace function public.budget_sync_event_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line_id uuid;
begin
  foreach v_line_id in array array_remove(array[new.line_id, case when tg_op = 'UPDATE' and old.line_id is distinct from new.line_id then old.line_id end, case when tg_op = 'DELETE' then old.line_id end], null)
  loop
    update public.budget_lines l
    set amount = coalesce((select sum(i.amount) from public.budget_items i where i.line_id = v_line_id), 0)
    where l.id = v_line_id and l.kind = 'event';
    perform public.budget_apply_event_plan(v_line_id);
  end loop;
  return null;
end;
$$;

-- A marketing item whose cost has already been moved to its new line keeps that cost,
-- instead of the cost being deleted and made again (which would lose its spending).
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

  -- Moved to another line, or unlinked: the old cost goes (unless it moved with the item).
  if tg_op = 'UPDATE' and old.budget_item_id is not null and new.budget_line_id is distinct from old.budget_line_id
     and not exists (select 1 from public.budget_items b where b.id = old.budget_item_id and b.line_id = new.budget_line_id) then
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

-- Moves an event from its line to another event line that isn't linked to anything.
-- Runs as the caller, so the usual budget permissions apply.
create or replace function public.move_event_budget_line(p_event_id uuid, p_to_line uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_from public.budget_lines;
  v_to public.budget_lines;
  v_offset integer;
begin
  select * into v_from from public.budget_lines where event_id = p_event_id for update;
  if v_from.id is null then
    raise exception 'This event isn''t on a budget line yet.' using errcode = 'P0002';
  end if;
  if v_from.id = p_to_line then
    return;
  end if;
  select * into v_to from public.budget_lines where id = p_to_line for update;
  if v_to.id is null or v_to.kind <> 'event' then
    raise exception 'Choose an event line from the list.' using errcode = 'P0002';
  end if;
  if v_to.event_id is not null then
    raise exception 'That line is already linked to another event.' using errcode = '23505';
  end if;

  update public.budget_lines set event_id = null, planned_amount = null where id = v_from.id;
  update public.budget_lines
  set event_id = p_event_id,
      -- What's set aside: the new line's own plan if it had one, else what the event had.
      planned_amount = coalesce(v_to.planned_amount, nullif(v_to.amount, 0), v_from.planned_amount)
  where id = v_to.id;

  -- Costs keep their order, after any the new line already has.
  select coalesce(max(sort_order), 0) into v_offset from public.budget_items where line_id = v_to.id;
  update public.budget_items set line_id = v_to.id, sort_order = sort_order + v_offset where line_id = v_from.id;
  update public.budget_expenses set line_id = v_to.id where line_id = v_from.id;
  update public.marketing_items set budget_line_id = v_to.id where budget_line_id = v_from.id;
end;
$$;
revoke all on function public.move_event_budget_line(uuid, uuid) from public, anon;
grant execute on function public.move_event_budget_line(uuid, uuid) to authenticated;
