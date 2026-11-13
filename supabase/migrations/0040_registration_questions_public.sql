-- Lets the public registration page read an event's custom questions and save a new
-- registrant's answers without the server's service key (which local copies don't have).
-- Both are narrow: questions only for published events; answers only onto a registration
-- made in the last hour that has none yet. The app checks the answers first. Safe to re-run.

create or replace function public.get_registration_questions(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select e.registration_questions from public.events e
     where e.slug = p_slug and e.status = 'published' and e.archived_at is null),
    '[]'::jsonb
  );
$$;

create or replace function public.save_registration_answers(p_ticket uuid, p_answers jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 50000 then
    return false;
  end if;
  update public.event_registrations
  set answers = p_answers
  where ticket_code = p_ticket and answers = '{}'::jsonb and created_at > now() - interval '1 hour';
  return found;
end;
$$;

revoke all on function public.get_registration_questions(text) from public;
revoke all on function public.save_registration_answers(uuid, jsonb) from public;
grant execute on function public.get_registration_questions(text) to anon, authenticated;
grant execute on function public.save_registration_answers(uuid, jsonb) to anon, authenticated;
