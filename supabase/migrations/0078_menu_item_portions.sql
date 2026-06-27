-- 0078: Add portions field to menu_items
-- Allows the same recipe to appear once with a multiplier (e.g. ×2 servings)

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS portions int NOT NULL DEFAULT 1 CHECK (portions >= 1);
