-- Storage locations for inventory items (Walk-in Fridge, Dry Store, Bar, etc.)
create table if not exists public.inventory_locations (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (team_id, name)
);

alter table public.inventory_locations enable row level security;

create policy "team members can read locations"
  on inventory_locations for select
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can insert locations"
  on inventory_locations for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can delete locations"
  on inventory_locations for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

create index on inventory_locations(team_id);

-- Link inventory items to a location (nullable — "unassigned" if null)
alter table public.inventory
  add column if not exists location_id uuid references public.inventory_locations(id) on delete set null;

create index if not exists inventory_location_id_idx on public.inventory(location_id);
