-- Add Slovak, Polish, Czech name columns to menu_items
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS name_sk text,
  ADD COLUMN IF NOT EXISTS name_pl text,
  ADD COLUMN IF NOT EXISTS name_cs text;
