-- ── Purchase Orders ────────────────────────────────────────────────────────────
create table if not exists public.purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status      text not null default 'draft'
                check (status in ('draft','sent','received','cancelled')),
  notes       text,
  ordered_at  timestamptz,
  received_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.purchase_orders enable row level security;

create policy "team members manage purchase orders"
  on public.purchase_orders for all
  using  (team_id in (select team_id from public.profiles where id = auth.uid()))
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

-- ── Purchase Order Items ───────────────────────────────────────────────────────
create table if not exists public.purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.purchase_orders(id) on delete cascade,
  inventory_item_id   uuid references public.inventory(id) on delete set null,
  name                text not null,
  quantity            numeric not null check (quantity > 0),
  unit                text not null,
  unit_price          numeric check (unit_price >= 0),
  created_at          timestamptz not null default now()
);

alter table public.purchase_order_items enable row level security;

create policy "team members manage order items"
  on public.purchase_order_items for all
  using (
    order_id in (
      select id from public.purchase_orders
      where team_id in (select team_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    order_id in (
      select id from public.purchase_orders
      where team_id in (select team_id from public.profiles where id = auth.uid())
    )
  );
