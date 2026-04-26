-- ── Suppliers ──────────────────────────────────────────────────────────────────
create table if not exists public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  name         text not null check (char_length(trim(name)) > 0),
  contact_name text,
  email        text,
  phone        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.suppliers enable row level security;

create policy "team members manage suppliers"
  on public.suppliers for all
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

-- Link inventory items to their supplier
alter table public.inventory
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
