-- Recipe Variations: link recipes as variants of each other (vegan, GF, etc.)

alter table recipes
  add column if not exists parent_recipe_id uuid references recipes(id) on delete set null,
  add column if not exists variation_label  text;   -- e.g. "Vegan", "Gluten-Free"

create index recipes_parent_idx on recipes(parent_recipe_id)
  where parent_recipe_id is not null;
