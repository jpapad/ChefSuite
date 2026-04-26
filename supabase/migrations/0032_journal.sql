-- ── Chef's Journal ────────────────────────────────────────────────────────────
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  title      text not null,
  content    text not null default '',
  tags       text[] not null default '{}',
  mood       smallint check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.journal_entries enable row level security;

create policy "team members manage journal entries"
  on public.journal_entries for all
  using (team_id in (select team_id from public.profiles where id = auth.uid()))
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

create index if not exists journal_entries_team_date
  on public.journal_entries (team_id, created_at desc);
