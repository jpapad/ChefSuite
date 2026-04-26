-- ── Prep Task Templates ────────────────────────────────────────────────────────
create table if not exists public.prep_templates (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.prep_template_items (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.prep_templates(id) on delete cascade,
  title          text not null,
  description    text,
  recipe_id      uuid references public.recipes(id) on delete set null,
  workstation_id uuid references public.workstations(id) on delete set null,
  quantity       numeric,
  sort_order     int not null default 0
);

alter table public.prep_templates       enable row level security;
alter table public.prep_template_items  enable row level security;

create policy "team members manage prep templates"
  on public.prep_templates for all
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members manage prep template items"
  on public.prep_template_items for all
  using (template_id in (
    select id from public.prep_templates
    where team_id in (select team_id from public.profiles where id = auth.uid())
  ));
