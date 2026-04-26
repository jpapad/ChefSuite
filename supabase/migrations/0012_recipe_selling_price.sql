-- Add optional selling price per portion to recipes for food-cost % calculation
alter table public.recipes
  add column if not exists selling_price numeric(10, 2);
