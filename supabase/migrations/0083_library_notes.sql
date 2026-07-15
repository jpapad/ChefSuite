create table if not exists library_notes (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  context_type text not null check (context_type in ('technique', 'glossary', 'spice')),
  context_key  text not null,
  note         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (team_id, user_id, context_type, context_key)
);

alter table library_notes enable row level security;

create policy "users can manage their own library notes"
  on library_notes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index on library_notes(team_id, context_type, context_key);
