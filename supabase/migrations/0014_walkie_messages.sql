-- Voice/walkie messages with AI-transcribed text
create table if not exists public.walkie_messages (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  transcript text not null check (char_length(trim(transcript)) > 0),
  created_at timestamptz not null default now()
);

alter table public.walkie_messages enable row level security;

create policy "team members can read walkie messages"
  on walkie_messages for select
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can insert walkie messages"
  on walkie_messages for insert
  with check (
    sender_id = auth.uid() and
    team_id = (select team_id from profiles where id = auth.uid())
  );

create policy "sender can delete own walkie messages"
  on walkie_messages for delete
  using (sender_id = auth.uid());

create index on walkie_messages(team_id, created_at desc);

alter publication supabase_realtime add table walkie_messages;
