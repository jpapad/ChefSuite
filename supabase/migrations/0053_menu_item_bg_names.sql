-- Add Bulgarian name and description fields to menu_items
alter table public.menu_items
  add column if not exists name_bg text,
  add column if not exists description_bg text;
