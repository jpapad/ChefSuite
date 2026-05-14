ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS descriptions_extra jsonb;
