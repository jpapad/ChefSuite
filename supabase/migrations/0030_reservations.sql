-- ── Table Reservations ─────────────────────────────────────────────────────────
create table if not exists public.reservations (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  guest_name       text not null check (char_length(trim(guest_name)) > 0),
  guest_phone      text,
  guest_email      text,
  party_size       int not null check (party_size > 0),
  reservation_date date not null,
  reservation_time time not null,
  status           text not null default 'pending'
                     check (status in ('pending','confirmed','seated','completed','cancelled')),
  notes            text,
  created_at       timestamptz not null default now()
);

alter table public.reservations enable row level security;

-- Guests can submit a reservation (no auth needed)
create policy "anyone can create a reservation"
  on public.reservations for insert
  with check (true);

-- Team members can view, update and delete their reservations
create policy "team members select reservations"
  on public.reservations for select
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members update reservations"
  on public.reservations for update
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members delete reservations"
  on public.reservations for delete
  using (team_id in (select team_id from public.profiles where id = auth.uid()));
