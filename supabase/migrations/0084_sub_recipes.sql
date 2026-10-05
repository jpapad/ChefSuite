-- ============================================================
-- Chefsuite — Sub-recipes (bases)
-- A recipe can use other recipes (stock, sauce, dough…) as components.
-- Quantities are per portion of the parent, expressed in portions of the
-- base — for a base, one "portion" is one unit of its yield_unit
-- (e.g. 0.25 L of stock).
-- ============================================================

alter table public.recipes
  add column if not exists is_base    boolean not null default false,
  add column if not exists yield_unit text;

create table if not exists public.recipe_sub_recipes (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  sub_recipe_id  uuid not null references public.recipes(id) on delete restrict,
  quantity       numeric(12,4) not null check (quantity > 0),
  created_at     timestamptz not null default now(),
  unique (recipe_id, sub_recipe_id),
  check (recipe_id <> sub_recipe_id)
);

alter table public.recipe_sub_recipes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recipe_sub_recipes' and policyname='team members manage sub recipes') then
    create policy "team members manage sub recipes"
      on public.recipe_sub_recipes for all
      using (team_id = public.current_team_id())
      with check (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists recipe_sub_recipes_recipe_idx on public.recipe_sub_recipes(recipe_id);
create index if not exists recipe_sub_recipes_sub_idx    on public.recipe_sub_recipes(sub_recipe_id);

-- ── Replace a recipe's sub-recipes atomically, rejecting cycles ─────────────
-- p_items: jsonb array of { sub_recipe_id: uuid, quantity: numeric }
create or replace function public.set_recipe_sub_recipes(
  p_recipe_id uuid,
  p_items     jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_team  uuid;
  v_cycle boolean;
begin
  select team_id into v_team from public.recipes where id = p_recipe_id;
  if v_team is null or v_team <> public.current_team_id() then
    raise exception 'Recipe not found' using errcode = '42501';
  end if;

  delete from public.recipe_sub_recipes where recipe_id = p_recipe_id;

  insert into public.recipe_sub_recipes (team_id, recipe_id, sub_recipe_id, quantity)
  select v_team, p_recipe_id, (item->>'sub_recipe_id')::uuid, (item->>'quantity')::numeric
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as item
   where (item->>'quantity')::numeric > 0;

  if exists (
    select 1 from public.recipe_sub_recipes s
      join public.recipes r on r.id = s.sub_recipe_id
     where s.recipe_id = p_recipe_id and r.team_id <> v_team
  ) then
    raise exception 'Sub-recipe belongs to another team' using errcode = '42501';
  end if;

  with recursive walk(node, depth) as (
    select sub_recipe_id, 1 from public.recipe_sub_recipes where recipe_id = p_recipe_id
    union
    select s.sub_recipe_id, w.depth + 1
      from walk w join public.recipe_sub_recipes s on s.recipe_id = w.node
     where w.depth < 10
  )
  select exists (select 1 from walk where node = p_recipe_id) into v_cycle;

  if v_cycle then
    raise exception 'A recipe cannot contain itself (circular sub-recipes)' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.set_recipe_sub_recipes(uuid, jsonb) from public;
grant execute on function public.set_recipe_sub_recipes(uuid, jsonb) to authenticated;

-- ── consume_recipe: expand sub-recipes down to raw inventory ────────────────
create or replace function public.consume_recipe(
  p_recipe_id uuid,
  p_portions  numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_team       uuid;
  v_ingredient record;
  v_has_rows   boolean := false;
begin
  if p_portions is null or p_portions <= 0 then
    raise exception 'Portions must be greater than zero' using errcode = '22023';
  end if;

  select team_id into v_team from public.recipes where id = p_recipe_id;
  if v_team is null then
    raise exception 'Recipe not found' using errcode = '22023';
  end if;
  if v_team <> public.current_team_id() then
    raise exception 'Recipe belongs to another team' using errcode = '42501';
  end if;

  for v_ingredient in
    with recursive tree(recipe_id, mult, depth) as (
      select p_recipe_id, p_portions::numeric, 0
      union all
      select s.sub_recipe_id, t.mult * s.quantity, t.depth + 1
        from tree t join public.recipe_sub_recipes s on s.recipe_id = t.recipe_id
       where t.depth < 10
    ), needs as (
      select ri.inventory_item_id, sum(ri.quantity * t.mult) as needed
        from tree t join public.recipe_ingredients ri on ri.recipe_id = t.recipe_id
       group by ri.inventory_item_id
    )
    select i.name, i.quantity as on_hand, n.needed
      from needs n join public.inventory i on i.id = n.inventory_item_id
  loop
    v_has_rows := true;
    if v_ingredient.on_hand < v_ingredient.needed then
      raise exception 'Not enough stock for % (need %, have %)',
        v_ingredient.name, round(v_ingredient.needed, 3), v_ingredient.on_hand
        using errcode = '23514';
    end if;
  end loop;

  if not v_has_rows then
    raise exception 'Recipe has no ingredients to consume' using errcode = '22023';
  end if;

  -- One statement → either every ingredient is deducted or none is.
  with recursive tree(recipe_id, mult, depth) as (
    select p_recipe_id, p_portions::numeric, 0
    union all
    select s.sub_recipe_id, t.mult * s.quantity, t.depth + 1
      from tree t join public.recipe_sub_recipes s on s.recipe_id = t.recipe_id
     where t.depth < 10
  ), needs as (
    select ri.inventory_item_id, sum(ri.quantity * t.mult) as needed
      from tree t join public.recipe_ingredients ri on ri.recipe_id = t.recipe_id
     group by ri.inventory_item_id
  )
  update public.inventory i
     set quantity = i.quantity - n.needed
    from needs n
   where n.inventory_item_id = i.id;
end;
$$;

revoke all on function public.consume_recipe(uuid, numeric) from public;
grant execute on function public.consume_recipe(uuid, numeric) to authenticated;
