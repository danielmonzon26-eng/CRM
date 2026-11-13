-- One more kind of marketing item: Newsletter/eBlast. (0036, 0039 and 0047, which re-add
-- the category checks each time migrations run, list it too.) Safe to re-run.

alter table public.marketing_items drop constraint if exists marketing_items_item_type_check;
alter table public.marketing_items add constraint marketing_items_item_type_check
  check (item_type in ('social', 'online_advertising', 'production', 'creative', 'event_materials', 'onsite_advertising', 'newsletter'));

alter table public.budget_items drop constraint if exists budget_items_marketing_category_check;
alter table public.budget_items add constraint budget_items_marketing_category_check
  check (marketing_category is null or marketing_category in ('creative', 'social', 'online_advertising', 'sponsorship', 'advertising', 'production', 'event_materials', 'onsite_advertising', 'newsletter'));

create or replace function public.marketing_item_label(p_type text)
returns text language sql immutable set search_path = '' as $$
  select case p_type
    when 'social' then 'Social'
    when 'online_advertising' then 'Online Advertising'
    when 'production' then 'Production'
    when 'event_materials' then 'Event Materials'
    when 'onsite_advertising' then 'Onsite Advertising'
    when 'newsletter' then 'Newsletter/eBlast'
    else 'Creative'
  end;
$$;
