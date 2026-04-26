-- ── Waste Log ──────────────────────────────────────────────────────────────────
create table if not exists public.waste_entries (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  item_id      uuid references public.inventory(id) on delete set null,
  item_name    text not null,
  quantity     numeric not null check (quantity > 0),
  unit         text not null default '',
  reason       text not null check (reason in ('expired','spoiled','overproduction','dropped','other')),
  cost         numeric,
  recorded_by  uuid references public.profiles(id) on delete set null,
  wasted_at    date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.waste_entries enable row level security;

create policy "team members manage waste entries"
  on public.waste_entries for all
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create index if not exists waste_entries_team_date
  on public.waste_entries (team_id, wasted_at desc);
