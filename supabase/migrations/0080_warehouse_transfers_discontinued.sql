-- 0080: Warehouse transfers + product discontinued flag

-- ── Discontinued flag on wh_products ─────────────────────────────────────────
alter table wh_products
  add column if not exists discontinued boolean not null default false;

-- ── Transfers ─────────────────────────────────────────────────────────────────
create table if not exists wh_transfers (
  id              uuid primary key default gen_random_uuid(),
  from_location_id uuid references wh_storage_locations(id) on delete set null,
  to_location_id   uuid references wh_storage_locations(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending','sent','partial','rejected','completed')),
  requested_by     text,
  notes            text,
  rejection_reason text,
  needed_by        date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists wh_transfer_items (
  id                  uuid primary key default gen_random_uuid(),
  transfer_id         uuid not null references wh_transfers(id) on delete cascade,
  product_id          uuid references wh_products(id) on delete set null,
  product_name        text not null,
  unit                text not null default 'τεμ',
  requested_quantity  numeric(12,3) not null default 0,
  fulfilled_quantity  numeric(12,3) not null default 0,
  created_at          timestamptz not null default now()
);

alter table wh_transfers      enable row level security;
alter table wh_transfer_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='wh_transfers' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_transfers for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='wh_transfer_items' and policyname='wh_auth_all') then
    create policy wh_auth_all on wh_transfer_items for all to authenticated using (true) with check (true);
  end if;
end $$;
