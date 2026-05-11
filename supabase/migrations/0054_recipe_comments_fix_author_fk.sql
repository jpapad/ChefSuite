-- Fix recipe_comments: re-create with author_id → profiles(id) so PostgREST
-- can traverse the relationship and return full_name in a single query.
-- Also creates the table if it doesn't exist yet (idempotent).

do $$
begin
  -- Drop old table if it exists with the wrong FK
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'recipe_comments'
  ) then
    -- Only drop if author_id still references auth.users
    if exists (
      select 1 from information_schema.referential_constraints rc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = rc.constraint_name
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = rc.unique_constraint_name
      where kcu.table_name = 'recipe_comments'
        and kcu.column_name = 'author_id'
        and ccu.table_schema = 'auth'
    ) then
      drop table recipe_comments cascade;
    end if;
  end if;
end $$;

create table if not exists recipe_comments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table recipe_comments enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'recipe_comments' and policyname = 'team members can read recipe comments'
  ) then
    create policy "team members can read recipe comments"
      on recipe_comments for select
      using (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'recipe_comments' and policyname = 'team members can insert recipe comments'
  ) then
    create policy "team members can insert recipe comments"
      on recipe_comments for insert
      with check (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'recipe_comments' and policyname = 'comment authors can delete own comments'
  ) then
    create policy "comment authors can delete own comments"
      on recipe_comments for delete
      using (author_id = auth.uid());
  end if;
end $$;

create index if not exists recipe_comments_recipe_idx on recipe_comments(recipe_id, created_at desc);
