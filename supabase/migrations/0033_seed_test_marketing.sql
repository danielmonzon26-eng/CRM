-- TEST marketing data so the planner, approvals board and initiatives have something to
-- try: two initiatives (linked to the TEST events from 0030 when they exist) and eight
-- posts across LinkedIn, Facebook and Instagram in all three statuses. No images: those
-- have to be uploaded files, so the Instagram posts stay Requested (Instagram needs an
-- image). Runs once (marker), so deleting them in the app keeps them deleted. Times are
-- Calgary time (UTC-6).

do $$
declare
  v_li uuid;
  v_fb uuid;
  v_ig uuid;
  v_dec uuid;
  v_pitch uuid;
  p record;
  v_post uuid;
begin
  if exists (select 1 from public.migration_markers where key = '0033_seed_test_marketing') then
    return;
  end if;

  -- The main account on each platform: a "Catapult on ..." channel if there is one.
  select id into v_li from public.marketing_channels where platform = 'linkedin' and active order by (name ilike 'Catapult%') desc, sort_order limit 1;
  select id into v_fb from public.marketing_channels where platform = 'facebook' and active order by (name ilike 'Catapult%') desc, sort_order limit 1;
  select id into v_ig from public.marketing_channels where platform = 'instagram' and active order by (name ilike 'Catapult%') desc, sort_order limit 1;

  insert into public.marketing_initiatives (name, objective, event_id, starts_on, ends_on, budget)
  values (
    'TEST – December events push',
    'Fill every December event: 40 at the Founders Breakfast, 30 at the Apex Forum Workshop, 100 on the Funding 101 Webinar. Test data: safe to delete.',
    (select id from public.events where title = 'TEST – Founders Breakfast' order by created_at desc limit 1),
    '2026-11-16', '2026-12-17', 1500
  )
  returning id into v_dec;

  insert into public.marketing_initiatives (name, objective, event_id, starts_on, ends_on, budget)
  values (
    'TEST – Investor Pitch Night promotion',
    '80 registrations for Investor Pitch Night, in the room and online, and six strong startups pitching. Test data: safe to delete.',
    (select id from public.events where title = 'TEST – Investor Pitch Night' order by created_at desc limit 1),
    '2026-12-01', '2027-01-21', 2500
  )
  returning id into v_pitch;

  for p in
    select * from (values
      (v_dec, 'TEST – Founders Breakfast announcement', 'approved', timestamptz '2026-11-19 09:00-06',
       E'Founders, breakfast is on us. ☕\n\nJoin other Calgary founders and the Catapult team on Thursday, December 3 at 7:30 a.m. for coffee, introductions and a quick round of asks and offers.\n\nFree, but seats are limited. Register at the link.\n\n#yyc #startups #founders',
       array['linkedin', 'facebook'], null::text),
      (v_dec, 'TEST – Founders Breakfast last call', 'waiting_approval', timestamptz '2026-12-01 10:00-06',
       E'Last call for Thursday''s Founders Breakfast! A few seats left. ☕\n\nRegister today and bring a question you''d like the room''s help with.\n\n#yyc #founders',
       array['linkedin', 'facebook'], null),
      (v_dec, 'TEST – Apex Forum Workshop: 5 seats left', 'waiting_approval', timestamptz '2026-12-07 12:00-06',
       E'Only 5 seats left for the Apex Forum go-to-market workshop on December 10.\n\nThree hands-on hours on finding your first 100 customers, with templates you can use the next morning. $25, coffee included.\n\n#gotomarket #startups #yyc',
       array['linkedin'], null),
      (v_dec, 'TEST – Funding 101 Webinar reminder', 'approved', timestamptz '2026-12-15 09:00-06',
       E'Funding 101 is this Thursday at noon. 💡 Grants, angels and first rounds in one hour, online and free. Bring your questions.',
       array['facebook'], null),
      (v_dec, 'TEST – Year-End Mixer photo carousel', 'requested', timestamptz '2026-12-14 11:00-06',
       E'What a night! Thanks to everyone who came out to the Year-End Mixer. 🎉 #yyc #community',
       array['instagram'], 'Add 5–6 photos from the night and keep the caption short. Instagram needs at least one image.'),
      (v_pitch, 'TEST – Pitch Night tickets on sale', 'approved', timestamptz '2026-12-02 09:00-06',
       E'Tickets are on sale for Investor Pitch Night! 🚀\n\nSix startups. One panel of investors. January 21, in the room or streamed live.\n\n$40 in person, free online.\n\n#yyc #startups #venturecapital',
       array['linkedin', 'facebook'], null),
      (v_pitch, 'TEST – Pitch Night startups reveal', 'requested', timestamptz '2027-01-07 12:00-06',
       E'Meet the six startups pitching at Investor Pitch Night... (names to come once confirmed)',
       array['linkedin', 'instagram'], null),
      (null::uuid, 'TEST – Year in review idea', 'requested', null::timestamptz,
       '', array[]::text[], null)
    ) as t(initiative_id, title, status, scheduled_at, caption, platforms, review_note)
  loop
    insert into public.social_posts (initiative_id, title, caption, scheduled_at, status, review_note)
    values (p.initiative_id, p.title, p.caption, p.scheduled_at, p.status, p.review_note)
    returning id into v_post;

    insert into public.social_post_channels (post_id, channel_id)
    select v_post, c from unnest(array[
      case when 'linkedin' = any (p.platforms) then v_li end,
      case when 'facebook' = any (p.platforms) then v_fb end,
      case when 'instagram' = any (p.platforms) then v_ig end
    ]) as c
    where c is not null;
  end loop;

  insert into public.migration_markers (key) values ('0033_seed_test_marketing');
end;
$$;
