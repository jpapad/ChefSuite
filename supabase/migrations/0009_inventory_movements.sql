create table inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  item_id     uuid not null references inventory(id) on delete cascade,
  delta       numeric not null,
  reason      text not null,
  user_id     uuid references profiles(id) on delete set null,
  created_at  timestamptz default now()
);

alter table inventory_movements enable row level security;

create policy "team members can read movements"
  on inventory_movements for select
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can insert movements"
  on inventory_movements for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));

create index on inventory_movements(item_id, created_at desc);
