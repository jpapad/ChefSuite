-- ============================================================
-- Chefsuite — "Make N portions" action
-- Atomically deducts a recipe's ingredients × N portions from
-- inventory. Fails if ANY ingredient has insufficient stock.
-- ============================================================

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
  v_team        uuid;
  v_ingredient  record;
  v_has_rows    boolean := false;
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

  -- Validate all ingredients have enough stock before touching anything.
  for v_ingredient in
    select i.id, i.name, i.quantity as on_hand, ri.quantity * p_portions as needed
      from public.recipe_ingredients ri
      join public.inventory i on i.id = ri.inventory_item_id
     where ri.recipe_id = p_recipe_id
  loop
    v_has_rows := true;
    if v_ingredient.on_hand < v_ingredient.needed then
      raise exception 'Not enough stock for % (need %, have %)',
        v_ingredient.name, v_ingredient.needed, v_ingredient.on_hand
        using errcode = '23514';
    end if;
  end loop;

  if not v_has_rows then
    raise exception 'Recipe has no ingredients to consume' using errcode = '22023';
  end if;

  -- Single SQL statement, runs inside the function's implicit transaction,
  -- so either every ingredient is deducted or none is.
  update public.inventory i
     set quantity = i.quantity - (ri.quantity * p_portions)
    from public.recipe_ingredients ri
   where ri.recipe_id = p_recipe_id
     and ri.inventory_item_id = i.id;
end;
$$;

revoke all on function public.consume_recipe(uuid, numeric) from public;
grant execute on function public.consume_recipe(uuid, numeric) to authenticated;
