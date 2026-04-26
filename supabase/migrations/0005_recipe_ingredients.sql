-- ============================================================
-- Chefsuite — Recipe ↔ Inventory binding
-- Adds ingredient cost tracking, recipe_ingredients join table,
-- RLS, realtime, and an atomic set_recipe_ingredients RPC.
-- ============================================================

-- ------------------------------------------------------------
-- Inventory: per-unit purchase cost (used for auto-costing recipes)
-- ------------------------------------------------------------
alter table public.inventory
  add column if not exists cost_per_unit numeric(10, 4);

-- ------------------------------------------------------------
-- Join table: a recipe uses N inventory items, each with a quantity
-- Unit is inherited from the inventory item — callers convert if needed
-- ------------------------------------------------------------
create table if not exists public.recipe_ingredients (
  id                uuid primary key default gen_random_uuid(),
  recipe_id         uuid not null references public.recipes(id)   on delete cascade,
  inventory_item_id uuid not null references public.inventory(id) on delete restrict,
  quantity          numeric(12, 3) not null check (quantity > 0),
  created_at        timestamptz not null default now(),
  unique (recipe_id, inventory_item_id)
);
create index if not exists recipe_ingredients_recipe_id_idx
  on public.recipe_ingredients(recipe_id);
create index if not exists recipe_ingredients_inventory_item_id_idx
  on public.recipe_ingredients(inventory_item_id);

-- ------------------------------------------------------------
-- Row Level Security
-- Visibility is derived from the recipe's team — teammates can
-- CRUD ingredients, others can't even read them.
-- ------------------------------------------------------------
alter table public.recipe_ingredients enable row level security;

drop policy if exists recipe_ingredients_select_team on public.recipe_ingredients;
drop policy if exists recipe_ingredients_insert_team on public.recipe_ingredients;
drop policy if exists recipe_ingredients_update_team on public.recipe_ingredients;
drop policy if exists recipe_ingredients_delete_team on public.recipe_ingredients;

create policy recipe_ingredients_select_team on public.recipe_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.team_id = public.current_team_id()
    )
  );

create policy recipe_ingredients_insert_team on public.recipe_ingredients
  for insert to authenticated
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.team_id = public.current_team_id()
    )
    and exists (
      select 1 from public.inventory i
      where i.id = inventory_item_id and i.team_id = public.current_team_id()
    )
  );

create policy recipe_ingredients_update_team on public.recipe_ingredients
  for update to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.team_id = public.current_team_id()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.team_id = public.current_team_id()
    )
  );

create policy recipe_ingredients_delete_team on public.recipe_ingredients
  for delete to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_id and r.team_id = public.current_team_id()
    )
  );

-- ------------------------------------------------------------
-- Atomic replace of a recipe's ingredient list
-- items: jsonb array of { inventory_item_id: uuid, quantity: numeric }
-- ------------------------------------------------------------
create or replace function public.set_recipe_ingredients(
  p_recipe_id uuid,
  p_items     jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.recipes where id = p_recipe_id;
  if v_team is null then
    raise exception 'Recipe not found';
  end if;
  if v_team <> public.current_team_id() then
    raise exception 'Recipe belongs to another team';
  end if;

  delete from public.recipe_ingredients where recipe_id = p_recipe_id;

  if p_items is not null and jsonb_array_length(p_items) > 0 then
    insert into public.recipe_ingredients (recipe_id, inventory_item_id, quantity)
    select
      p_recipe_id,
      (item->>'inventory_item_id')::uuid,
      (item->>'quantity')::numeric
    from jsonb_array_elements(p_items) as item;
  end if;
end;
$$;

revoke all on function public.set_recipe_ingredients(uuid, jsonb) from public;
grant execute on function public.set_recipe_ingredients(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'recipe_ingredients'
  ) then
    alter publication supabase_realtime add table public.recipe_ingredients;
  end if;
end $$;

alter table public.recipe_ingredients replica identity full;
