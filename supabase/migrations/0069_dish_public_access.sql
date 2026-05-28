-- Public read access for dish QR scanning (no auth required)
-- Uses security definer so anon can read a single item by exact UUID
-- without opening the whole menu_items table to public scans.

create or replace function public.get_dish_public(item_id uuid)
returns table (
  id              uuid,
  name            text,
  name_el         text,
  name_bg         text,
  name_uk         text,
  name_ro         text,
  name_sr         text,
  name_sk         text,
  name_pl         text,
  name_cs         text,
  name_sl         text,
  name_tr         text,
  name_md         text,
  description     text,
  description_el  text,
  description_bg  text,
  descriptions_extra jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select
    mi.id,
    mi.name,
    mi.name_el,
    mi.name_bg,
    mi.name_uk,
    mi.name_ro,
    mi.name_sr,
    mi.name_sk,
    mi.name_pl,
    mi.name_cs,
    mi.name_sl,
    mi.name_tr,
    mi.name_md,
    mi.description,
    mi.description_el,
    mi.description_bg,
    mi.descriptions_extra
  from public.menu_items mi
  where mi.id = item_id;
$$;

-- Restrict to anon only (remove default public execute)
revoke all on function public.get_dish_public(uuid) from public;
grant execute on function public.get_dish_public(uuid) to anon;
grant execute on function public.get_dish_public(uuid) to authenticated;
