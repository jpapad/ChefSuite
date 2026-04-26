create table if not exists public.prep_task_steps (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.prep_tasks(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null,
  done        boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.prep_task_steps enable row level security;

create policy "team members can manage prep steps"
  on public.prep_task_steps for all to authenticated
  using  (team_id = (select team_id from public.profiles where id = auth.uid()))
  with check (team_id = (select team_id from public.profiles where id = auth.uid()));

create index if not exists prep_task_steps_task_idx on public.prep_task_steps(task_id);
create index if not exists prep_task_steps_team_idx on public.prep_task_steps(team_id);
