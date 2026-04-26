create table if not exists public.recipe_versions (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  team_id     uuid not null,
  saved_by    uuid references auth.users(id),
  title       text not null,
  description text,
  instructions text,
  cost_per_portion numeric,
  selling_price    numeric,
  allergens   text[] not null default '{}',
  category    text,
  created_at  timestamptz not null default now()
);

alter table public.recipe_versions enable row level security;

create policy "team members can view recipe versions"
  on public.recipe_versions for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

create policy "team members can insert recipe versions"
  on public.recipe_versions for insert
  with check (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );
