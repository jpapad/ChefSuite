-- HACCP Reminders: scheduled temperature check reminders per location

create table haccp_reminders (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  location     text not null,
  label        text not null,
  frequency_h  numeric(5,1) not null default 4,   -- hours between checks
  next_due     timestamptz not null,
  assignee_id  uuid references auth.users(id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table haccp_reminders enable row level security;

create policy "team members can manage haccp reminders"
  on haccp_reminders for all
  using (team_id = (select team_id from profiles where id = auth.uid()))
  with check (team_id = (select team_id from profiles where id = auth.uid()));

create index haccp_reminders_team_idx on haccp_reminders(team_id, active, next_due);
