-- ── Staff Timeclock ────────────────────────────────────────────────────────────
create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  clock_in   timestamptz not null default now(),
  clock_out  timestamptz,
  notes      text,
  created_at timestamptz not null default now(),
  constraint no_overlap check (clock_out is null or clock_out > clock_in)
);

alter table public.time_entries enable row level security;

create policy "team members manage time entries"
  on public.time_entries for all
  using  (team_id in (select team_id from public.profiles where id = auth.uid()))
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));
