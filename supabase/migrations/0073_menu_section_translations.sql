-- Add translation columns to menus and menu_sections
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_el text;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS name_bg text;
ALTER TABLE menu_sections ADD COLUMN IF NOT EXISTS name_el text;
ALTER TABLE menu_sections ADD COLUMN IF NOT EXISTS name_bg text;
