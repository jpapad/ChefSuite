-- ── Online Orders ──────────────────────────────────────────────────────────────
create table if not exists public.online_orders (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  menu_id        uuid references public.menus(id) on delete set null,
  table_ref      text,
  customer_name  text,
  customer_notes text,
  status         text not null default 'pending'
                   check (status in ('pending','preparing','ready','completed','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.online_order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.online_orders(id) on delete cascade,
  menu_item_id   uuid references public.menu_items(id) on delete set null,
  name           text not null,
  price          numeric,
  quantity       int not null check (quantity > 0),
  notes          text,
  created_at     timestamptz not null default now()
);

alter table public.online_orders enable row level security;
alter table public.online_order_items enable row level security;

-- Anyone can place an order (public menu)
create policy "anyone can place an order"
  on public.online_orders for insert
  with check (true);

-- Team members manage their orders
create policy "team members manage orders"
  on public.online_orders for all
  using  (team_id in (select team_id from public.profiles where id = auth.uid()))
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

-- Anyone can add items to an order they just created
create policy "anyone can add order items"
  on public.online_order_items for insert
  with check (true);

-- Team members can view and manage order items
create policy "team members manage order items"
  on public.online_order_items for all
  using (
    order_id in (
      select id from public.online_orders
      where team_id in (select team_id from public.profiles where id = auth.uid())
    )
  );
