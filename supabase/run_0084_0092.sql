-- ============================================================
-- ChefSuite — new features (migrations 0084 → 0092)
-- Paste into the Supabase SQL Editor and run once, in this order.
-- ============================================================

-- >>> 0084_sub_recipes.sql
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

-- >>> 0085_public_menu_allergens.sql
-- ============================================================
-- Chefsuite — Allergens for the public (QR) menu
-- Guests can't read recipes, so this exposes only the allergen list of each
-- item on an active menu — including allergens inherited from bases
-- (sub-recipes, migration 0084). Items without a linked recipe return null
-- ("unknown — ask staff").
-- ============================================================

create or replace function public.get_public_menu_allergens(p_menu_id uuid)
returns table (item_id uuid, allergens text[])
language sql
stable
security definer
set search_path = public
as $$
  with recursive items as (
    select mi.id as item_id, mi.recipe_id
      from public.menu_items mi
      join public.menu_sections ms on ms.id = mi.section_id
      join public.menus m on m.id = ms.menu_id
     where m.id = p_menu_id and m.active = true and mi.available = true
  ),
  tree(item_id, recipe_id, depth) as (
    select item_id, recipe_id, 0 from items where recipe_id is not null
    union all
    select t.item_id, s.sub_recipe_id, t.depth + 1
      from tree t join public.recipe_sub_recipes s on s.recipe_id = t.recipe_id
     where t.depth < 10
  ),
  flat as (
    select t.item_id, a.allergen
      from tree t
      join public.recipes r on r.id = t.recipe_id
      cross join lateral unnest(r.allergens) as a(allergen)
  )
  select i.item_id,
         case when i.recipe_id is null then null
              else coalesce((select array_agg(distinct f.allergen) from flat f where f.item_id = i.item_id), '{}')
         end
    from items i;
$$;

revoke all on function public.get_public_menu_allergens(uuid) from public;
grant execute on function public.get_public_menu_allergens(uuid) to anon, authenticated;

-- >>> 0086_staff_certificates.sql
-- ============================================================
-- Chefsuite — Staff certificates
-- Health cards (βιβλιάριο υγείας), HACCP / food-safety training, first aid,
-- fire safety… with expiry dates. Managers see everyone's; staff see their own.
-- Scans are kept in a private bucket, one folder per team.
-- ============================================================

create or replace function public.is_team_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role::text in ('owner', 'executive_chef', 'head_chef')
  );
$$;

revoke all on function public.is_team_manager() from public;
grant execute on function public.is_team_manager() to authenticated;

create table if not exists public.staff_certificates (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('health_card', 'haccp', 'food_safety', 'first_aid', 'fire_safety', 'other')),
  title        text,
  issued_on    date,
  expires_on   date,
  doc_path     text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.staff_certificates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='staff_certificates' and policyname='certificates readable by managers and owner') then
    create policy "certificates readable by managers and owner"
      on public.staff_certificates for select
      using (team_id = public.current_team_id() and (public.is_team_manager() or user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='staff_certificates' and policyname='managers manage certificates') then
    create policy "managers manage certificates"
      on public.staff_certificates for all
      using (team_id = public.current_team_id() and public.is_team_manager())
      with check (team_id = public.current_team_id() and public.is_team_manager());
  end if;
end $$;

create index if not exists staff_certificates_team_idx on public.staff_certificates(team_id, expires_on);
create index if not exists staff_certificates_user_idx on public.staff_certificates(user_id);

-- ── Private bucket for scans ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-docs', 'staff-docs', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='staff_docs_select') then
    create policy staff_docs_select on storage.objects for select to authenticated
      using (bucket_id = 'staff-docs' and (storage.foldername(name))[1] = public.current_team_id()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='staff_docs_insert') then
    create policy staff_docs_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'staff-docs' and (storage.foldername(name))[1] = public.current_team_id()::text and public.is_team_manager());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='staff_docs_delete') then
    create policy staff_docs_delete on storage.objects for delete to authenticated
      using (bucket_id = 'staff-docs' and (storage.foldername(name))[1] = public.current_team_id()::text and public.is_team_manager());
  end if;
end $$;

-- >>> 0087_lot_traceability.sql
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

-- >>> 0088_equipment.sql
-- ============================================================
-- Chefsuite — Equipment & maintenance
-- Fridges, ovens, hoods… with service schedule, technician contact and a log
-- of services / repairs / issues. Equipment can be linked to a HACCP location:
-- 3 out-of-range readings within 24h open an issue automatically.
-- ============================================================

create table if not exists public.equipment (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references public.teams(id) on delete cascade,
  name                   text not null,
  category               text not null default 'other'
                         check (category in ('fridge', 'freezer', 'oven', 'stove', 'dishwasher', 'hood', 'coffee', 'ice', 'other')),
  location               text,
  brand                  text,
  model                  text,
  serial_number          text,
  purchased_on           date,
  warranty_until         date,
  service_interval_days  integer check (service_interval_days is null or service_interval_days > 0),
  last_service_on        date,
  technician_name        text,
  technician_phone       text,
  haccp_location         text,
  status                 text not null default 'ok' check (status in ('ok', 'attention', 'out_of_order')),
  notes                  text,
  created_at             timestamptz not null default now()
);

create table if not exists public.equipment_logs (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  kind          text not null check (kind in ('service', 'repair', 'issue', 'inspection')),
  title         text not null,
  description   text,
  cost          numeric(10,2),
  performed_on  date not null default current_date,
  resolved      boolean not null default true,
  resolved_at   timestamptz,
  auto          boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.equipment      enable row level security;
alter table public.equipment_logs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='equipment' and policyname='team members manage equipment') then
    create policy "team members manage equipment" on public.equipment for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='equipment_logs' and policyname='team members manage equipment logs') then
    create policy "team members manage equipment logs" on public.equipment_logs for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists equipment_team_idx       on public.equipment(team_id, status);
create index if not exists equipment_logs_equip_idx on public.equipment_logs(equipment_id, performed_on desc);
create index if not exists equipment_logs_open_idx  on public.equipment_logs(team_id) where resolved = false;

-- ── A service log moves the "last service" date forward ─────────────────────
create or replace function public.equipment_log_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'service' then
    update public.equipment
       set last_service_on = greatest(coalesce(last_service_on, new.performed_on), new.performed_on)
     where id = new.equipment_id;
  end if;
  if new.kind = 'issue' and not new.resolved then
    update public.equipment set status = 'attention' where id = new.equipment_id and status = 'ok';
  end if;
  return new;
end;
$$;

drop trigger if exists equipment_log_after_insert on public.equipment_logs;
create trigger equipment_log_after_insert
  after insert on public.equipment_logs
  for each row execute function public.equipment_log_after_insert();

-- ── HACCP → equipment: repeated failed readings open an issue ───────────────
create or replace function public.haccp_check_equipment_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fails integer;
  v_equip record;
begin
  if new.temperature between new.min_temp and new.max_temp then
    return new;
  end if;

  select count(*) into v_fails
    from public.haccp_checks
   where team_id = new.team_id
     and location = new.location
     and created_at > now() - interval '24 hours'
     and (temperature < min_temp or temperature > max_temp);

  if v_fails < 3 then
    return new;
  end if;

  for v_equip in
    select id from public.equipment
     where team_id = new.team_id and haccp_location = new.location
  loop
    if not exists (
      select 1 from public.equipment_logs
       where equipment_id = v_equip.id and kind = 'issue' and resolved = false and auto = true
    ) then
      insert into public.equipment_logs (team_id, equipment_id, kind, title, description, resolved, auto)
      values (
        new.team_id, v_equip.id, 'issue',
        'HACCP: ' || v_fails || ' readings out of range in 24h',
        'Last reading ' || new.temperature || '°' || new.unit || ' (allowed ' || new.min_temp || '–' || new.max_temp || ')',
        false, true
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists haccp_check_equipment_alert on public.haccp_checks;
create trigger haccp_check_equipment_alert
  after insert on public.haccp_checks
  for each row execute function public.haccp_check_equipment_alert();

-- >>> 0089_dish_feedback.sql
-- ============================================================
-- Chefsuite — Guest feedback from the QR menu
-- Guests rate the dishes they had (1–5 stars + optional comment). Anonymous
-- visitors can only write through submit_dish_feedback, which checks that
-- the item is on an active menu. The team reads it in the app.
-- ============================================================

create table if not exists public.dish_feedback (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  menu_id       uuid references public.menus(id) on delete set null,
  menu_item_id  uuid references public.menu_items(id) on delete set null,
  recipe_id     uuid references public.recipes(id) on delete set null,
  item_name     text not null,
  rating        smallint not null check (rating between 1 and 5),
  comment       text check (comment is null or char_length(comment) <= 500),
  lang          text,
  created_at    timestamptz not null default now()
);

alter table public.dish_feedback enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='dish_feedback' and policyname='team members read feedback') then
    create policy "team members read feedback" on public.dish_feedback for select
      using (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='dish_feedback' and policyname='team members delete feedback') then
    create policy "team members delete feedback" on public.dish_feedback for delete
      using (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists dish_feedback_team_idx on public.dish_feedback(team_id, created_at desc);
create index if not exists dish_feedback_item_idx on public.dish_feedback(menu_item_id);
create index if not exists dish_feedback_recipe_idx on public.dish_feedback(recipe_id);

create or replace function public.submit_dish_feedback(
  p_menu_id  uuid,
  p_item_id  uuid,
  p_rating   integer,
  p_comment  text default null,
  p_lang     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1–5' using errcode = '22023';
  end if;

  select mi.id, mi.name, mi.recipe_id, m.team_id
    into v_item
    from public.menu_items mi
    join public.menu_sections ms on ms.id = mi.section_id
    join public.menus m on m.id = ms.menu_id
   where mi.id = p_item_id and m.id = p_menu_id and m.active = true;

  if v_item is null then
    raise exception 'Dish not found' using errcode = '22023';
  end if;

  -- Light flood guard: max 30 ratings per dish per 10 minutes
  if (select count(*) from public.dish_feedback
       where menu_item_id = p_item_id and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Too many ratings, try again later' using errcode = '54000';
  end if;

  insert into public.dish_feedback (team_id, menu_id, menu_item_id, recipe_id, item_name, rating, comment, lang)
  values (v_item.team_id, p_menu_id, p_item_id, v_item.recipe_id, v_item.name, p_rating,
          nullif(left(trim(coalesce(p_comment, '')), 500), ''), left(p_lang, 5));
end;
$$;

revoke all on function public.submit_dish_feedback(uuid, uuid, integer, text, text) from public;
grant execute on function public.submit_dish_feedback(uuid, uuid, integer, text, text) to anon, authenticated;

-- >>> 0090_par_levels.sql
-- ============================================================
-- Chefsuite — Par levels for automatic order suggestions
-- par_level = the stock you want right after a delivery. When empty, the
-- app uses 2 × min_stock_level.
-- ============================================================

alter table public.inventory
  add column if not exists par_level numeric(12,3) check (par_level is null or par_level >= 0);

-- >>> 0091_training.sql
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

-- >>> 0092_catering_events.sql
-- ============================================================
-- Chefsuite — Catering & events
-- An event goes inquiry → quoted → confirmed → completed. It holds the client,
-- date, guests and a menu (recipes × portions). The app builds the quote, the
-- confirmation, the production sheet and the shopping list from it.
-- ============================================================

create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  title             text not null,
  client_name       text,
  client_phone      text,
  client_email      text,
  event_date        date,
  event_time        text,
  venue             text,
  guests            integer not null default 0 check (guests >= 0),
  status            text not null default 'inquiry'
                    check (status in ('inquiry', 'quoted', 'confirmed', 'completed', 'cancelled')),
  price_per_person  numeric(10,2),
  deposit           numeric(10,2),
  deposit_paid      boolean not null default false,
  terms             text,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.event_items (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  name        text not null,
  portions    numeric(10,2) not null default 0 check (portions >= 0),
  course      text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.events      enable row level security;
alter table public.event_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='events' and policyname='team members manage events') then
    create policy "team members manage events" on public.events for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='event_items' and policyname='team members manage event items') then
    create policy "team members manage event items" on public.event_items for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists events_team_date_idx on public.events(team_id, event_date);
create index if not exists event_items_event_idx on public.event_items(event_id, sort_order);
