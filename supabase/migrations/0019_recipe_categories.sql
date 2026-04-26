-- Recipe categories
alter table public.recipes
  add column if not exists category text
    check (category in ('appetizer','soup','salad','main','side','sauce','bread','dessert','beverage','other'));
