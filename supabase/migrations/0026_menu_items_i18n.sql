alter table public.menu_items
  add column if not exists name_el        text,
  add column if not exists description_el text;
