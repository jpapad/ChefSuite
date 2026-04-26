-- Menus: à la carte, buffet, tasting, daily specials
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type text not null default 'a_la_carte'
    check (type in ('a_la_carte', 'buffet', 'tasting', 'daily')),
  description text,
  price_per_person numeric(10, 2),
  active boolean not null default true,
  show_prices boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sections within a menu (e.g. Starters, Mains, Desserts)
create table if not exists public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Items within a section
create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.menu_sections(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  price numeric(10, 2),
  available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.menus enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;

-- menus: team members read, write
create policy "team read menus"
  on public.menus for select
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team insert menus"
  on public.menus for insert
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team update menus"
  on public.menus for update
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team delete menus"
  on public.menus for delete
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

-- Public read for menus (for public menu URL — anon can read active menus)
create policy "public read active menus"
  on public.menus for select
  using (active = true);

-- menu_sections: team members read/write
create policy "team read menu_sections"
  on public.menu_sections for select
  using (menu_id in (select id from public.menus where team_id in (
    select team_id from public.profiles where id = auth.uid()
  )));

create policy "team insert menu_sections"
  on public.menu_sections for insert
  with check (menu_id in (select id from public.menus where team_id in (
    select team_id from public.profiles where id = auth.uid()
  )));

create policy "team update menu_sections"
  on public.menu_sections for update
  using (menu_id in (select id from public.menus where team_id in (
    select team_id from public.profiles where id = auth.uid()
  )));

create policy "team delete menu_sections"
  on public.menu_sections for delete
  using (menu_id in (select id from public.menus where team_id in (
    select team_id from public.profiles where id = auth.uid()
  )));

-- Public read for sections of active menus
create policy "public read menu_sections"
  on public.menu_sections for select
  using (menu_id in (select id from public.menus where active = true));

-- menu_items: team members read/write
create policy "team read menu_items"
  on public.menu_items for select
  using (section_id in (select s.id from public.menu_sections s
    join public.menus m on m.id = s.menu_id
    where m.team_id in (select team_id from public.profiles where id = auth.uid())
  ));

create policy "team insert menu_items"
  on public.menu_items for insert
  with check (section_id in (select s.id from public.menu_sections s
    join public.menus m on m.id = s.menu_id
    where m.team_id in (select team_id from public.profiles where id = auth.uid())
  ));

create policy "team update menu_items"
  on public.menu_items for update
  using (section_id in (select s.id from public.menu_sections s
    join public.menus m on m.id = s.menu_id
    where m.team_id in (select team_id from public.profiles where id = auth.uid())
  ));

create policy "team delete menu_items"
  on public.menu_items for delete
  using (section_id in (select s.id from public.menu_sections s
    join public.menus m on m.id = s.menu_id
    where m.team_id in (select team_id from public.profiles where id = auth.uid())
  ));

-- Public read for items of active menus
create policy "public read menu_items"
  on public.menu_items for select
  using (section_id in (select s.id from public.menu_sections s
    join public.menus m on m.id = s.menu_id where m.active = true
  ));
