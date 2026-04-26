create table if not exists public.menu_scans (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references public.menus(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  user_agent text
);

-- Public insert — no auth needed (anyone viewing the public menu)
alter table public.menu_scans enable row level security;

create policy "anyone can record a scan"
  on public.menu_scans for insert
  with check (true);

create policy "team members can view scans"
  on public.menu_scans for select
  using (
    menu_id in (
      select id from public.menus
      where team_id in (
        select team_id from public.profiles where id = auth.uid()
      )
    )
  );
