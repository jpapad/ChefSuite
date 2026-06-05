-- Buffet Map: visual floor plan of the buffet with live dish status

-- ── Layout table (permanent, one per team) ────────────────────────────────────
create table if not exists public.buffet_maps (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  name         text not null default 'Χάρτης Μπουφέ',
  stations     jsonb not null default '[]',
  -- stations: [{id, name, x, y, width, height, color, slotCount}]
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.buffet_maps enable row level security;

create policy "team members select buffet_maps"
  on public.buffet_maps for select
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members insert buffet_maps"
  on public.buffet_maps for insert
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members update buffet_maps"
  on public.buffet_maps for update
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members delete buffet_maps"
  on public.buffet_maps for delete
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

-- Allow anon to read map layouts (needed for public floor plan page)
create policy "anon read buffet_maps"
  on public.buffet_maps for select
  to anon
  using (true);

-- ── Daily assignment table ────────────────────────────────────────────────────
create table if not exists public.buffet_map_assignments (
  id        uuid primary key default gen_random_uuid(),
  map_id    uuid not null references public.buffet_maps(id) on delete cascade,
  team_id   uuid not null references public.teams(id) on delete cascade,
  date      date not null default current_date,
  slots     jsonb not null default '{}',
  -- slots: {"stationId_slotIndex": {"menuItemId": "uuid", "dishName": "text"}}
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(map_id, date)
);

alter table public.buffet_map_assignments enable row level security;

create policy "team members select assignments"
  on public.buffet_map_assignments for select
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members insert assignments"
  on public.buffet_map_assignments for insert
  with check (team_id in (select team_id from public.profiles where id = auth.uid()));

create policy "team members update assignments"
  on public.buffet_map_assignments for update
  using (team_id in (select team_id from public.profiles where id = auth.uid()));

-- Allow anon to read assignments (needed for public floor plan)
create policy "anon read assignments"
  on public.buffet_map_assignments for select
  to anon
  using (true);

-- Allow anon to read buffet_live_status (for live status on public map)
-- (only add if the policy doesn't already exist)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'buffet_live_status'
      and policyname = 'anon read buffet_live_status'
  ) then
    execute $policy$
      create policy "anon read buffet_live_status"
        on public.buffet_live_status for select
        to anon
        using (true)
    $policy$;
  end if;
end
$$;

-- Enable realtime on the new tables
alter publication supabase_realtime add table public.buffet_live_status;
