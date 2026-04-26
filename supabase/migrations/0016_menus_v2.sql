-- Add date range validity to menus
alter table public.menus
  add column if not exists valid_from date,
  add column if not exists valid_to   date;

-- Add tags to menu_items (e.g. vegan, gluten_free, spicy, chefs_pick)
alter table public.menu_items
  add column if not exists tags text[] not null default '{}';
