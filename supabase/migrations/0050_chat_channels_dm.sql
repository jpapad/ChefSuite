-- Add channel support to existing team_messages (backward compatible)
alter table team_messages add column if not exists channel text not null default 'general';

create index if not exists team_messages_channel_idx
  on team_messages(team_id, channel, created_at);

-- Direct messages (completely separate table, doesn't touch existing data)
create table if not exists direct_messages (
  id           uuid        primary key default gen_random_uuid(),
  team_id      uuid        not null,
  sender_id    uuid        not null references auth.users(id) on delete cascade,
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  content      text        not null check (char_length(content) between 1 and 4000),
  created_at   timestamptz not null default now()
);

alter table direct_messages enable row level security;

create index if not exists direct_messages_team_pair_idx
  on direct_messages(team_id, sender_id, recipient_id, created_at);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'direct_messages'
    and policyname = 'team members can access their direct messages'
  ) then
    create policy "team members can access their direct messages"
      on direct_messages for all
      using (auth.uid() = sender_id or auth.uid() = recipient_id)
      with check (auth.uid() = sender_id);
  end if;
end $$;
