-- ============================================================
-- Chefsuite — Staff training
-- Modules are either SOPs (procedures to read and acknowledge) or quizzes
-- (multiple choice — e.g. generated from a recipe's real quantities).
-- Managers create modules and see everyone's progress; staff take them.
-- Requires is_team_manager() from migration 0086.
-- ============================================================

create table if not exists public.training_modules (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  kind        text not null check (kind in ('sop', 'quiz')),
  title       text not null,
  body        text,
  recipe_id   uuid references public.recipes(id) on delete set null,
  questions   jsonb not null default '[]'::jsonb,
  pass_pct    smallint not null default 80 check (pass_pct between 1 and 100),
  required    boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.training_completions (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  module_id     uuid not null references public.training_modules(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  score         smallint check (score between 0 and 100),
  passed        boolean not null,
  answers       jsonb,
  completed_at  timestamptz not null default now()
);

alter table public.training_modules     enable row level security;
alter table public.training_completions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='training_modules' and policyname='team reads training modules') then
    create policy "team reads training modules" on public.training_modules for select
      using (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='training_modules' and policyname='managers manage training modules') then
    create policy "managers manage training modules" on public.training_modules for all
      using (team_id = public.current_team_id() and public.is_team_manager())
      with check (team_id = public.current_team_id() and public.is_team_manager());
  end if;
  if not exists (select 1 from pg_policies where tablename='training_completions' and policyname='read own or as manager') then
    create policy "read own or as manager" on public.training_completions for select
      using (team_id = public.current_team_id() and (user_id = auth.uid() or public.is_team_manager()));
  end if;
  if not exists (select 1 from pg_policies where tablename='training_completions' and policyname='record own completion') then
    create policy "record own completion" on public.training_completions for insert
      with check (team_id = public.current_team_id() and user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='training_completions' and policyname='managers delete completions') then
    create policy "managers delete completions" on public.training_completions for delete
      using (team_id = public.current_team_id() and public.is_team_manager());
  end if;
end $$;

create index if not exists training_modules_team_idx     on public.training_modules(team_id, created_at desc);
create index if not exists training_completions_mod_idx  on public.training_completions(module_id, user_id, completed_at desc);
