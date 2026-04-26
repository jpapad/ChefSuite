-- ============================================================
-- Chefsuite — Prep scheduling
-- Daily prep tasks: one row per task, scheduled for a date,
-- optionally linked to a recipe and/or assigned to a member.
-- Completion is tracked by done_at (null = pending).
-- ============================================================

create table if not exists public.prep_tasks (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id)    on delete cascade,
  title       text not null,
  description text,
  recipe_id   uuid references public.recipes(id)           on delete set null,
  quantity    numeric(12, 3),
  assignee_id uuid references public.profiles(id)          on delete set null,
  prep_for    date not null,
  done_at     timestamptz,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists prep_tasks_team_date_idx
  on public.prep_tasks(team_id, prep_for);
create index if not exists prep_tasks_assignee_idx
  on public.prep_tasks(assignee_id);

-- ------------------------------------------------------------
-- Row Level Security
-- All team members can CRUD their team's tasks.
-- ------------------------------------------------------------
alter table public.prep_tasks enable row level security;

drop policy if exists prep_tasks_select_team on public.prep_tasks;
drop policy if exists prep_tasks_insert_team on public.prep_tasks;
drop policy if exists prep_tasks_update_team on public.prep_tasks;
drop policy if exists prep_tasks_delete_team on public.prep_tasks;

create policy prep_tasks_select_team on public.prep_tasks
  for select to authenticated
  using (team_id = public.current_team_id());

create policy prep_tasks_insert_team on public.prep_tasks
  for insert to authenticated
  with check (
    team_id = public.current_team_id()
    and created_by = auth.uid()
  );

create policy prep_tasks_update_team on public.prep_tasks
  for update to authenticated
  using (team_id = public.current_team_id())
  with check (team_id = public.current_team_id());

create policy prep_tasks_delete_team on public.prep_tasks
  for delete to authenticated
  using (team_id = public.current_team_id());

-- ------------------------------------------------------------
-- updated_at auto-touch (reuse existing set_updated_at function)
-- ------------------------------------------------------------
drop trigger if exists set_updated_at_prep_tasks on public.prep_tasks;
create trigger set_updated_at_prep_tasks
  before update on public.prep_tasks
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'prep_tasks'
  ) then
    alter publication supabase_realtime add table public.prep_tasks;
  end if;
end $$;

alter table public.prep_tasks replica identity full;
