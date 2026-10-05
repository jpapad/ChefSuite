-- ============================================================
-- Chefsuite — Lot traceability (HACCP / recalls)
-- Each delivery can be recorded as a lot (lot number + expiry). When a recipe
-- is made, consume_recipe draws from lots first-expiry-first-out and logs
-- which dish used which lot — so a supplier recall can be answered at once.
-- ============================================================

create table if not exists public.inventory_lots (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references public.teams(id) on delete cascade,
  inventory_item_id   uuid not null references public.inventory(id) on delete cascade,
  lot_number          text,
  expires_on          date,
  quantity_received   numeric(12,3) not null check (quantity_received >= 0),
  quantity_remaining  numeric(12,3) not null check (quantity_remaining >= 0),
  supplier_id         uuid references public.suppliers(id) on delete set null,
  purchase_order_id   uuid references public.purchase_orders(id) on delete set null,
  status              text not null default 'active' check (status in ('active', 'depleted', 'recalled', 'discarded')),
  notes               text,
  received_at         timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create table if not exists public.lot_usage (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  lot_id      uuid not null references public.inventory_lots(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  portions    numeric(10,2),
  quantity    numeric(12,3) not null,
  used_at     timestamptz not null default now(),
  used_by     uuid references auth.users(id) on delete set null
);

alter table public.inventory_lots enable row level security;
alter table public.lot_usage      enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='inventory_lots' and policyname='team members manage lots') then
    create policy "team members manage lots" on public.inventory_lots for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='lot_usage' and policyname='team members manage lot usage') then
    create policy "team members manage lot usage" on public.lot_usage for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists inventory_lots_item_idx   on public.inventory_lots(inventory_item_id, status, expires_on);
create index if not exists inventory_lots_team_idx   on public.inventory_lots(team_id, status, expires_on);
create index if not exists inventory_lots_number_idx on public.inventory_lots(team_id, lot_number);
create index if not exists lot_usage_lot_idx         on public.lot_usage(lot_id, used_at desc);

-- ── consume_recipe: sub-recipes (0084) + FEFO lot allocation ────────────────
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
  v_lot        record;
  v_left       numeric;
  v_take       numeric;
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
    select i.id, i.name, i.quantity as on_hand, n.needed
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

  -- Deduct stock and draw from lots (first expiry, first out). Items without
  -- lots are simply deducted; lots are a traceability layer on top of stock.
  for v_ingredient in
    with recursive tree(recipe_id, mult, depth) as (
      select p_recipe_id, p_portions::numeric, 0
      union all
      select s.sub_recipe_id, t.mult * s.quantity, t.depth + 1
        from tree t join public.recipe_sub_recipes s on s.recipe_id = t.recipe_id
       where t.depth < 10
    )
    select ri.inventory_item_id as id, sum(ri.quantity * t.mult) as needed
      from tree t join public.recipe_ingredients ri on ri.recipe_id = t.recipe_id
     group by ri.inventory_item_id
  loop
    update public.inventory set quantity = quantity - v_ingredient.needed where id = v_ingredient.id;

    v_left := v_ingredient.needed;
    for v_lot in
      select id, quantity_remaining from public.inventory_lots
       where inventory_item_id = v_ingredient.id and status = 'active' and quantity_remaining > 0
       order by expires_on nulls last, received_at
       for update
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_lot.quantity_remaining);
      update public.inventory_lots
         set quantity_remaining = quantity_remaining - v_take,
             status = case when quantity_remaining - v_take <= 0 then 'depleted' else status end
       where id = v_lot.id;
      insert into public.lot_usage (team_id, lot_id, recipe_id, portions, quantity, used_by)
      values (v_team, v_lot.id, p_recipe_id, p_portions, v_take, auth.uid());
      v_left := v_left - v_take;
    end loop;
  end loop;
end;
$$;

revoke all on function public.consume_recipe(uuid, numeric) from public;
grant execute on function public.consume_recipe(uuid, numeric) to authenticated;

-- ── Recall: mark a lot recalled and take what's left out of stock ───────────
create or replace function public.recall_lot(p_lot_id uuid, p_remove_stock boolean default true)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lot record;
begin
  select * into v_lot from public.inventory_lots where id = p_lot_id and team_id = public.current_team_id() for update;
  if v_lot is null then
    raise exception 'Lot not found' using errcode = '22023';
  end if;
  if p_remove_stock and v_lot.quantity_remaining > 0 then
    update public.inventory
       set quantity = greatest(0, quantity - v_lot.quantity_remaining)
     where id = v_lot.inventory_item_id;
  end if;
  update public.inventory_lots
     set status = 'recalled',
         quantity_remaining = case when p_remove_stock then 0 else quantity_remaining end
   where id = p_lot_id;
end;
$$;

revoke all on function public.recall_lot(uuid, boolean) from public;
grant execute on function public.recall_lot(uuid, boolean) to authenticated;
