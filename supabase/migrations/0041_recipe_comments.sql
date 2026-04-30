-- Recipe Comments: team members can leave notes/comments on recipes

create table recipe_comments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table recipe_comments enable row level security;

create policy "team members can read recipe comments"
  on recipe_comments for select
  using (team_id = (select team_id from profiles where id = auth.uid()));

create policy "team members can insert recipe comments"
  on recipe_comments for insert
  with check (team_id = (select team_id from profiles where id = auth.uid()));

create policy "comment authors can delete own comments"
  on recipe_comments for delete
  using (author_id = auth.uid());

create index recipe_comments_recipe_idx on recipe_comments(recipe_id, created_at desc);
