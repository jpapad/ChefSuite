create table team_messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references teams(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  content    text not null check (char_length(content) > 0 and char_length(content) <= 2000),
  created_at timestamptz default now()
);

alter table team_messages enable row level security;

create policy "team members can read messages"
  on team_messages for select
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can insert messages"
  on team_messages for insert
  with check (
    sender_id = auth.uid() and
    team_id = (select team_id from profiles where id = auth.uid())
  );

create policy "sender can delete own messages"
  on team_messages for delete
  using (sender_id = auth.uid());

create index on team_messages(team_id, created_at asc);

-- Enable realtime for this table
alter publication supabase_realtime add table team_messages;
