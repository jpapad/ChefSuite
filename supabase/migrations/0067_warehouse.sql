-- ============================================================
-- Warehouse Module (Inventa integration)
-- All tables prefixed with wh_ to avoid collisions
-- ============================================================

-- Categories
create table if not exists wh_categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  group_name   text,
  created_at   timestamptz not null default now()
);

-- Storage locations (θέσεις αποθήκης)
create table if not exists wh_storage_locations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  created_at   timestamptz not null default now()
);

-- Suppliers (warehouse-specific — separate from kitchen suppliers)
create table if not exists wh_suppliers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  phone                 text,
  email                 text,
  notes                 text,
  delivery_days         jsonb not null default '[]',   -- array of weekday indices 0-6
  order_lead_days       int  not null default 1,
  order_deadline_time   text not null default '12:00',
  created_at            timestamptz not null default now()
);

-- Products (stock items)
create table if not exists wh_products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  product_code     text,
  category_id      uuid references wh_categories(id) on delete set null,
  supplier_id      uuid references wh_suppliers(id)  on delete set null,
  storage_unit_id  uuid references wh_storage_locations(id) on delete set null,
  unit             text not null default 'τεμ',
  purchase_price   numeric(12,4),
  min_quantity     numeric(12,3) not null default 0,
  current_stock    numeric(12,3) not null default 0,
  notes            text,
  created_at       timestamptz not null default now()
);

-- Orders
create table if not exists wh_orders (
  id                       uuid primary key default gen_random_uuid(),
  supplier_id              uuid references wh_suppliers(id) on delete set null,
  status                   text not null default 'pending' check (status in ('pending','received','cancelled')),
  notes                    text,
  order_date               date,
  expected_delivery_date   date,
  received_at              timestamptz,
  invoice_total            numeric(12,2),
  created_at               timestamptz not null default now()
);

-- Order items
create table if not exists wh_order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references wh_orders(id) on delete cascade,
  product_id          uuid references wh_products(id) on delete set null,
  product_name        text not null,
  product_code        text,
  quantity            numeric(12,3) not null,
  unit                text,
  unit_price          numeric(12,4),
  invoice_price       numeric(12,4),
  received_quantity   numeric(12,3),
  backorder_quantity  numeric(12,3),
  backorder_status    text,                    -- 'will_deliver' | 'cancelled' | etc.
  backorder_charged   boolean default false,
  created_at          timestamptz not null default now()
);

-- Inventory sessions (απογραφές)
create table if not exists wh_inventory_sessions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  month             text not null,            -- 'YYYY-MM'
  item_count        int  not null default 0,
  is_draft          boolean not null default false,
  created_by        uuid,
  created_by_name   text,
  created_at        timestamptz not null default now()
);

-- Inventory session items
create table if not exists wh_inventory_session_items (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references wh_inventory_sessions(id) on delete cascade,
  product_id        uuid references wh_products(id) on delete set null,
  product_name      text not null,
  category_name     text,
  storage_unit_name text,
  unit              text,
  system_quantity   numeric(12,3),
  counted_quantity  numeric(12,3),
  counted_unit      text
);

-- Supplier catalogs (τιμοκατάλογοι)
create table if not exists wh_supplier_catalogs (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid references wh_suppliers(id) on delete cascade,
  name              text not null,
  source_filename   text,
  uploaded_by       uuid,
  uploaded_by_name  text,
  total_items       int  not null default 0,
  status            text not null default 'pending_review',
  uploaded_at       timestamptz not null default now()
);

-- Catalog items (γραμμές τιμοκαταλόγου)
create table if not exists wh_catalog_items (
  id                    uuid primary key default gen_random_uuid(),
  catalog_id            uuid not null references wh_supplier_catalogs(id) on delete cascade,
  raw_name              text not null,
  raw_packaging         text,
  raw_price             numeric(12,4),
  raw_price_unit_label  text,
  base_unit             text,
  price_per_base_unit   numeric(12,6),
  supplier_code         text,
  ai_subcategory        text
);

-- Product returns (επιστροφές)
create table if not exists wh_product_returns (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid references wh_products(id) on delete set null,
  product_name        text not null,
  supplier_id         uuid references wh_suppliers(id) on delete set null,
  supplier_name       text,
  quantity            numeric(12,3) not null,
  unit                text,
  reason              text,
  status              text not null default 'open' check (status in ('open','credited')),
  credit_received_at  timestamptz,
  created_by          uuid,
  created_by_name     text,
  created_at          timestamptz not null default now()
);

-- Supplier credits (πιστωτικά)
create table if not exists wh_supplier_credits (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid references wh_suppliers(id) on delete cascade,
  amount       numeric(12,2),
  credit_date  date not null,
  notes        text,
  created_at   timestamptz not null default now()
);

-- Order watchlist (λίστα παρακολούθησης επόμενης παραγγελίας)
create table if not exists wh_order_watchlist (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid unique not null references wh_products(id) on delete cascade,
  quantity    numeric(12,3),
  unit        text,
  created_at  timestamptz not null default now()
);

-- Activity logs (ιστορικό ενεργειών)
create table if not exists wh_activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid,
  username    text,
  role        text,
  action      text not null,
  target      text,
  details     text,
  created_at  timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists wh_products_supplier_idx      on wh_products(supplier_id);
create index if not exists wh_products_category_idx      on wh_products(category_id);
create index if not exists wh_products_storage_idx       on wh_products(storage_unit_id);
create index if not exists wh_order_items_order_idx      on wh_order_items(order_id);
create index if not exists wh_order_items_product_idx    on wh_order_items(product_id);
create index if not exists wh_orders_supplier_idx        on wh_orders(supplier_id);
create index if not exists wh_orders_status_idx          on wh_orders(status);
create index if not exists wh_catalog_items_catalog_idx  on wh_catalog_items(catalog_id);
create index if not exists wh_session_items_session_idx  on wh_inventory_session_items(session_id);
create index if not exists wh_activity_logs_action_idx   on wh_activity_logs(action);

-- ── RLS (Row Level Security) ─────────────────────────────────────────────────
-- Enable RLS on all warehouse tables and allow authenticated users full access.
-- Tighten per-role in Supabase dashboard if needed.

alter table wh_categories               enable row level security;
alter table wh_storage_locations        enable row level security;
alter table wh_suppliers                enable row level security;
alter table wh_products                 enable row level security;
alter table wh_orders                   enable row level security;
alter table wh_order_items              enable row level security;
alter table wh_inventory_sessions       enable row level security;
alter table wh_inventory_session_items  enable row level security;
alter table wh_supplier_catalogs        enable row level security;
alter table wh_catalog_items            enable row level security;
alter table wh_product_returns          enable row level security;
alter table wh_supplier_credits         enable row level security;
alter table wh_order_watchlist          enable row level security;
alter table wh_activity_logs            enable row level security;

-- Policies: authenticated users can read/write everything
do $$ begin
  if not exists (select 1 from pg_policies where tablename='wh_categories' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_categories for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_storage_locations' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_storage_locations for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_suppliers' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_suppliers for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_products' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_products for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_orders' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_orders for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_order_items' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_order_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_inventory_sessions' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_inventory_sessions for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_inventory_session_items' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_inventory_session_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_supplier_catalogs' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_supplier_catalogs for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_catalog_items' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_catalog_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_product_returns' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_product_returns for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_supplier_credits' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_supplier_credits for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_order_watchlist' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_order_watchlist for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_activity_logs' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_activity_logs for all to authenticated using (true) with check (true);
  end if;
end $$;
