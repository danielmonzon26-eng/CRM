-- Step 7: team accounts and roles.
--
-- One profile row per Supabase Auth user, auto-created on signup. `email` is
-- denormalized from auth.users so the /team page can display it without needing
-- service-role access to the auth schema.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'rep' check (role in ('admin', 'rep')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-creates a profile whenever someone signs up. The one hardcoded email becomes
-- admin on first sign-in so there's a working admin account without a manual SQL
-- step; everyone else defaults to 'rep'. Promote further admins via the /team page
-- (or directly in SQL) once at least one admin account exists.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  bootstrap_admin_email text := 'daniel.monzon26@gmail.com';
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when lower(new.email) = lower(bootstrap_admin_email) then 'admin' else 'rep' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- Any signed-in team member can see who's on the team (needed for the lead-assignee
-- picker), but only admins can change a role -- enforced here, not just in the UI.
create policy "profiles readable by authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles updatable by admins" on public.profiles
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
