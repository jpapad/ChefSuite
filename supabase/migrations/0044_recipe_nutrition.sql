-- Nutrition information per serving stored on recipes

alter table recipes
  add column if not exists calories   numeric(7,1),
  add column if not exists protein_g  numeric(7,2),
  add column if not exists carbs_g    numeric(7,2),
  add column if not exists fat_g      numeric(7,2),
  add column if not exists fiber_g    numeric(7,2),
  add column if not exists sodium_mg  numeric(8,1);
