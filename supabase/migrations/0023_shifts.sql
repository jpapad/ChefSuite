-- ── Shift Scheduling ──────────────────────────────────────────────────────────
create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  shift_date  date not null,
  start_time  time not null,
  end_time    time not null,
  role        text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint shifts_times_check check (end_time > start_time)
);

alter table public.shifts enable row level security;

create policy "team members manage shifts"
  on public.shifts for all
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create index if not exists shifts_team_date
  on public.shifts (team_id, shift_date);
