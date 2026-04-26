create table haccp_checks (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  location     text not null,
  temperature  numeric not null,
  unit         text not null default 'C' check (unit in ('C', 'F')),
  min_temp     numeric not null,
  max_temp     numeric not null,
  checked_by   uuid references profiles(id) on delete set null,
  notes        text,
  created_at   timestamptz default now()
);

alter table haccp_checks enable row level security;

create policy "team members can read haccp"
  on haccp_checks for select
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can insert haccp"
  on haccp_checks for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can delete haccp"
  on haccp_checks for delete
  using (team_id = (select team_id from profiles where id = auth.uid()));

create index on haccp_checks(team_id, created_at desc);

create table haccp_locations (
  id       uuid primary key default gen_random_uuid(),
  team_id  uuid not null references teams(id) on delete cascade,
  name     text not null,
  min_temp numeric not null,
  max_temp numeric not null,
  unit     text not null default 'C' check (unit in ('C', 'F'))
);

alter table haccp_locations enable row level security;

create policy "team members can manage haccp_locations"
  on haccp_locations for all
  using (team_id = (select team_id from profiles where id = auth.uid()))
  with check (team_id = (select team_id from profiles where id = auth.uid()));
