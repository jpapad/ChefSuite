-- Add extra language name columns to menu_items
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS name_ro text,
  ADD COLUMN IF NOT EXISTS name_sl text,
  ADD COLUMN IF NOT EXISTS name_uk text,
  ADD COLUMN IF NOT EXISTS name_tr text,
  ADD COLUMN IF NOT EXISTS name_sr text;
