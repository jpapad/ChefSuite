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
