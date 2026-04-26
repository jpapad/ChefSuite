alter table public.recipes
  add column if not exists prep_time  integer,
  add column if not exists cook_time  integer,
  add column if not exists servings   integer,
  add column if not exists difficulty text check (difficulty in ('easy', 'medium', 'hard'));

alter table public.recipe_versions
  add column if not exists prep_time  integer,
  add column if not exists cook_time  integer,
  add column if not exists servings   integer,
  add column if not exists difficulty text check (difficulty in ('easy', 'medium', 'hard'));
