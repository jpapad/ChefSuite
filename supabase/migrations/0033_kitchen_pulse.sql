-- ── Kitchen Pulse ─────────────────────────────────────────────────────────────
create table if not exists public.pulse_responses (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams(id) on delete cascade,
  week      date not null,          -- Monday of the ISO week
  morale    smallint not null check (morale between 1 and 5),
  workload  smallint not null check (workload between 1 and 5),
  note      text,
  created_at timestamptz not null default now()
  -- intentionally no author_id → anonymous
);

alter table public.pulse_responses enable row level security;

create policy "team members submit pulse"
  on public.pulse_responses for insert
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members read pulse"
  on public.pulse_responses for select
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create index if not exists pulse_team_week
  on public.pulse_responses (team_id, week desc);
