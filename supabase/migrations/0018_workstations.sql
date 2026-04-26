-- ── Workstations ──────────────────────────────────────────────────────────────
create table if not exists public.workstations (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.workstations enable row level security;

create policy "team members manage workstations"
  on public.workstations
  for all
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

-- ── prep_tasks: add workstation_id + status ────────────────────────────────────
alter table public.prep_tasks
  add column if not exists workstation_id uuid references public.workstations(id) on delete set null,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done'));

-- Back-fill status from done_at so existing tasks aren't all reset to pending
update public.prep_tasks
  set status = 'done'
  where done_at is not null and status = 'pending';
