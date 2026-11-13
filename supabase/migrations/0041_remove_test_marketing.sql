-- Removes the TEST marketing data, once: the TEST posts and initiatives (0033), the
-- automatic post requests made for the TEST events (0034), and any promotions or
-- marketing items on those events. The TEST events themselves are left alone. Runs once
-- (marker), so nothing named TEST made later is touched.

do $$
declare
  v_events uuid[];
begin
  if exists (select 1 from public.migration_markers where key = '0041_remove_test_marketing') then
    return;
  end if;

  select coalesce(array_agg(id), '{}') into v_events from public.events
  where title like 'TEST – %'
    and slug ~ '^test-(founders-breakfast|apex-forum-workshop|funding-101-webinar|investor-pitch-night|year-end-mixer)-[0-9a-f]{6}$';

  delete from public.marketing_promotions where event_id = any (v_events);
  delete from public.marketing_items where event_id = any (v_events);
  delete from public.social_posts where title like 'TEST – %' or event_id = any (v_events);
  delete from public.marketing_initiatives where name like 'TEST – %';

  insert into public.migration_markers (key) values ('0041_remove_test_marketing');
end;
$$;
