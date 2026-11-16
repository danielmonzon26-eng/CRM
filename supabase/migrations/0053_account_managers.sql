-- Account managers: the only people who can open Admin and create users, set passwords,
-- or remove access. When this was added there were exactly two accounts (Steve and Dan),
-- so every account that existed then becomes a manager, once. Later accounts don't.
-- Only the server (or an existing manager) can change who is a manager. Safe to re-run.

alter table public.profiles add column if not exists can_manage_users boolean not null default false;

do $$
begin
  if not exists (select 1 from public.migration_markers where key = '0053_account_managers') then
    update public.profiles set can_manage_users = true;
    insert into public.migration_markers (key) values ('0053_account_managers');
  end if;
end;
$$;

-- Admins can update profiles (names, roles), but not make themselves a manager.
create or replace function public.profiles_protect_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.can_manage_users is distinct from old.can_manage_users
     and auth.uid() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.can_manage_users) then
    raise exception 'Only an account manager can change who manages accounts.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_manager on public.profiles;
create trigger profiles_protect_manager before update of can_manage_users on public.profiles
  for each row execute function public.profiles_protect_manager();
