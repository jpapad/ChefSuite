-- ============================================================
-- Chefsuite — Catering & events
-- An event goes inquiry → quoted → confirmed → completed. It holds the client,
-- date, guests and a menu (recipes × portions). The app builds the quote, the
-- confirmation, the production sheet and the shopping list from it.
-- ============================================================

create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  team_id           uuid not null references public.teams(id) on delete cascade,
  title             text not null,
  client_name       text,
  client_phone      text,
  client_email      text,
  event_date        date,
  event_time        text,
  venue             text,
  guests            integer not null default 0 check (guests >= 0),
  status            text not null default 'inquiry'
                    check (status in ('inquiry', 'quoted', 'confirmed', 'completed', 'cancelled')),
  price_per_person  numeric(10,2),
  deposit           numeric(10,2),
  deposit_paid      boolean not null default false,
  terms             text,
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.event_items (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  recipe_id   uuid references public.recipes(id) on delete set null,
  name        text not null,
  portions    numeric(10,2) not null default 0 check (portions >= 0),
  course      text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.events      enable row level security;
alter table public.event_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='events' and policyname='team members manage events') then
    create policy "team members manage events" on public.events for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='event_items' and policyname='team members manage event items') then
    create policy "team members manage event items" on public.event_items for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists events_team_date_idx on public.events(team_id, event_date);
create index if not exists event_items_event_idx on public.event_items(event_id, sort_order);
