-- ============================================================
-- Chefsuite — Initial schema, RLS, and auth automation
-- Run in Supabase SQL Editor (or via `supabase db push`).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$ begin
  create type public.user_role as enum
    ('owner', 'head_chef', 'sous_chef', 'cook', 'staff');
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  role       public.user_role not null default 'cook',
  full_name  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_team_id_idx on public.profiles(team_id);

create table if not exists public.recipes (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  title            text not null,
  description      text,
  instructions     text,
  cost_per_portion numeric(10, 2),
  allergens        text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists recipes_team_id_idx on public.recipes(team_id);

create table if not exists public.inventory (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  name            text not null,
  quantity        numeric(12, 3) not null default 0,
  unit            text not null,
  min_stock_level numeric(12, 3) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists inventory_team_id_idx on public.inventory(team_id);

-- ------------------------------------------------------------
-- Helper: current user's team
-- SECURITY DEFINER so it bypasses RLS when reading profiles —
-- this prevents recursion when it's used inside profile policies.
-- ------------------------------------------------------------
create or replace function public.current_team_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select team_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_team_id() from public;
grant execute on function public.current_team_id() to authenticated;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.teams     enable row level security;
alter table public.profiles  enable row level security;
alter table public.recipes   enable row level security;
alter table public.inventory enable row level security;

-- teams: members see/update their own team; any authed user may create one.
drop policy if exists teams_select_own  on public.teams;
drop policy if exists teams_insert_any  on public.teams;
drop policy if exists teams_update_own  on public.teams;

create policy teams_select_own on public.teams
  for select to authenticated
  using (id = public.current_team_id());

create policy teams_insert_any on public.teams
  for insert to authenticated
  with check (true);

create policy teams_update_own on public.teams
  for update to authenticated
  using (id = public.current_team_id())
  with check (id = public.current_team_id());

-- profiles: you always see your own row; teammates see each other.
drop policy if exists profiles_select_team   on public.profiles;
drop policy if exists profiles_insert_self   on public.profiles;
drop policy if exists profiles_update_self   on public.profiles;

create policy profiles_select_team on public.profiles
  for select to authenticated
  using (id = auth.uid() or team_id = public.current_team_id());

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- recipes: full CRUD scoped to the caller's team.
drop policy if exists recipes_select_team on public.recipes;
drop policy if exists recipes_insert_team on public.recipes;
drop policy if exists recipes_update_team on public.recipes;
drop policy if exists recipes_delete_team on public.recipes;

create policy recipes_select_team on public.recipes
  for select to authenticated
  using (team_id = public.current_team_id());

create policy recipes_insert_team on public.recipes
  for insert to authenticated
  with check (team_id = public.current_team_id());

create policy recipes_update_team on public.recipes
  for update to authenticated
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());

create policy recipes_delete_team on public.recipes
  for delete to authenticated
  using (team_id = public.current_team_id());

-- inventory: same shape as recipes.
drop policy if exists inventory_select_team on public.inventory;
drop policy if exists inventory_insert_team on public.inventory;
drop policy if exists inventory_update_team on public.inventory;
drop policy if exists inventory_delete_team on public.inventory;

create policy inventory_select_team on public.inventory
  for select to authenticated
  using (team_id = public.current_team_id());

create policy inventory_insert_team on public.inventory
  for insert to authenticated
  with check (team_id = public.current_team_id());

create policy inventory_update_team on public.inventory
  for update to authenticated
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());

create policy inventory_delete_team on public.inventory
  for delete to authenticated
  using (team_id = public.current_team_id());

-- ------------------------------------------------------------
-- updated_at auto-touch
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_profiles  on public.profiles;
drop trigger if exists set_updated_at_recipes   on public.recipes;
drop trigger if exists set_updated_at_inventory on public.inventory;

create trigger set_updated_at_profiles
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_updated_at_recipes
  before update on public.recipes
  for each row execute function public.set_updated_at();

create trigger set_updated_at_inventory
  before update on public.inventory
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Auto-create profile on signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
