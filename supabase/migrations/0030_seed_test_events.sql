-- Five published TEST events for trying out registration, the event pages and the
-- editable Budget tab. Runs once: a migration_markers row stops it from running again
-- on later merges, so deleting the events in the app keeps them deleted. Each event gets
-- a line in the budget that covers its month (or the newest budget), with its costs as
-- items; with no budget at all, only the planned total is set. Safe to re-run.

do $$
declare
  ev record;
  v_event_id uuid;
  v_budget record;
  v_line_id uuid;
  v_section text;
  v_month date;
  v_item record;
  v_order integer;
begin
  if exists (select 1 from public.migration_markers where key = '0030_seed_test_events') then
    return;
  end if;

  for ev in
    select * from (values
      ('TEST – Founders Breakfast', 'Breakfast', 'Apex Forum', 'in_person',
       'An early-morning breakfast for founders to meet each other and the Catapult team. Test event: safe to delete.',
       'TEST venue: Catapult boardroom', '100 Test Street SW, Calgary, AB', null,
       timestamptz '2026-12-03 07:30 America/Edmonton', timestamptz '2026-12-03 09:00 America/Edmonton',
       'free', null::numeric, 40, 60,
       '[["Venue", 300], ["Catering", 750], ["Materials", 120]]'::jsonb),
      ('TEST – Apex Forum Workshop', 'Workshop', 'Apex Forum', 'in_person',
       'A hands-on afternoon workshop on go-to-market planning. Test event: safe to delete.',
       'TEST venue: Innovation Hall, Room 2', '200 Test Avenue NW, Calgary, AB', null,
       timestamptz '2026-12-10 13:00 America/Edmonton', timestamptz '2026-12-10 16:00 America/Edmonton',
       'paid', 25, 30, 35,
       '[["Venue", 500], ["Speaker fee", 1000], ["Catering", 450], ["Ad spend", 300]]'::jsonb),
      ('TEST – Funding 101 Webinar', 'Webinar', null, 'online',
       'A one-hour online session on grants, angels and first rounds. Test event: safe to delete.',
       null, null, 'https://example.com/test-webinar',
       timestamptz '2026-12-17 12:00 America/Edmonton', timestamptz '2026-12-17 13:00 America/Edmonton',
       'free', null, 100, null,
       '[["Ad spend", 400], ["Webinar software", 80]]'::jsonb),
      ('TEST – Investor Pitch Night', 'Pitch night', null, 'hybrid',
       'Six startups pitch to a panel of investors, in the room and streamed. Test event: safe to delete.',
       'TEST venue: Event Centre, Main Hall', '300 Test Boulevard SE, Calgary, AB', 'https://example.com/test-pitch-stream',
       timestamptz '2027-01-21 18:00 America/Edmonton', timestamptz '2027-01-21 21:00 America/Edmonton',
       'paid', 40, 80, 120,
       '[["Venue", 1500], ["AV and streaming", 900], ["Catering", 1800], ["Marketing", 600]]'::jsonb),
      ('TEST – Year-End Mixer', 'Social', null, 'in_person',
       'A relaxed year-end get-together for the community. Test event: safe to delete.',
       'TEST venue: Rooftop Lounge', '400 Test Street SW, Calgary, AB', null,
       timestamptz '2026-12-12 17:00 America/Edmonton', timestamptz '2026-12-12 20:00 America/Edmonton',
       'free', null, 50, 75,
       '[["Venue", 800], ["Food and drink", 1200], ["Decor", 150]]'::jsonb)
    ) as t(title, event_type, program, format, description, venue_name, venue_address, online_url,
           starts_at, ends_at, ticket_type, ticket_price, target_attendees, capacity, costs)
  loop
    insert into public.events (
      slug, title, event_type, program, format, description, venue_name, venue_address, online_url,
      starts_at, ends_at, ticket_type, ticket_price, target_attendees, capacity, status,
      registration_opens_at, registration_closes_at, confirmation_message, funding_source
    ) values (
      lower(regexp_replace(regexp_replace(ev.title, '[^A-Za-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) || '-' || left(md5(random()::text), 6),
      ev.title, ev.event_type, ev.program, ev.format, ev.description, ev.venue_name, ev.venue_address, ev.online_url,
      ev.starts_at, ev.ends_at, ev.ticket_type, ev.ticket_price, ev.target_attendees, ev.capacity, 'published',
      now(), ev.starts_at, 'You''re registered for this test event. See you there!', 'Test data'
    )
    returning id into v_event_id;

    v_month := date_trunc('month', ev.starts_at at time zone 'America/Edmonton')::date;
    select b.id, b.start_month, b.end_month into v_budget
    from public.budgets b
    order by (b.start_month is not null and b.end_month is not null and v_month between b.start_month and b.end_month) desc,
             b.created_at desc
    limit 1;

    if v_budget.id is null then
      update public.events
      set budget_amount = (select sum((c->>1)::numeric) from jsonb_array_elements(ev.costs) c)
      where id = v_event_id;
      continue;
    end if;

    select coalesce((
      select l.section from public.budget_lines l
      where l.budget_id = v_budget.id and l.kind = 'event'
      group by l.section order by count(*) desc, l.section limit 1
    ), 'Events') into v_section;

    if v_budget.start_month is not null and v_month < v_budget.start_month then v_month := v_budget.start_month; end if;
    if v_budget.end_month is not null and v_month > v_budget.end_month then v_month := v_budget.end_month; end if;

    v_line_id := public.budget_add_line(v_budget.id, 'event', v_section, ev.title, v_month);
    update public.budget_lines set event_id = v_event_id where id = v_line_id;

    v_order := 0;
    for v_item in select c->>0 as name, (c->>1)::numeric as amount from jsonb_array_elements(ev.costs) c loop
      v_order := v_order + 1;
      insert into public.budget_items (line_id, name, amount, sort_order) values (v_line_id, v_item.name, v_item.amount, v_order);
    end loop;
  end loop;

  insert into public.migration_markers (key) values ('0030_seed_test_events');
  raise notice 'TEST events created: %', (select string_agg(slug, ', ') from public.events where title like 'TEST – %');
end;
$$;
