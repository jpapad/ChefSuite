create table if not exists ingredient_price_history (
  id               uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references inventory(id) on delete cascade,
  old_price        numeric(10,4),
  new_price        numeric(10,4) not null,
  changed_at       timestamptz not null default now()
);

alter table ingredient_price_history enable row level security;

create policy "team members can view price history"
  on ingredient_price_history for select
  using (
    exists (
      select 1 from inventory i
      join team_members tm on tm.team_id = i.team_id
      where i.id = ingredient_price_history.inventory_item_id
        and tm.user_id = auth.uid()
    )
  );

create policy "team members can insert price history"
  on ingredient_price_history for insert
  with check (
    exists (
      select 1 from inventory i
      join team_members tm on tm.team_id = i.team_id
      where i.id = ingredient_price_history.inventory_item_id
        and tm.user_id = auth.uid()
    )
  );

create index on ingredient_price_history(inventory_item_id, changed_at desc);
