-- ============================================================
-- Chefsuite — Enable Supabase Realtime for recipes & inventory
-- Run once in the SQL Editor.
-- ============================================================

-- Add tables to the realtime publication so clients receive
-- postgres_changes events for INSERT / UPDATE / DELETE.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recipes'
  ) then
    execute 'alter publication supabase_realtime add table public.recipes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory'
  ) then
    execute 'alter publication supabase_realtime add table public.inventory';
  end if;
end $$;

-- REPLICA IDENTITY FULL makes DELETE payloads include the full
-- old row (not just the primary key) — useful if clients need
-- any field from a deleted row for UI (e.g. team_id for routing
-- via the filter). Safe for small tables like these.
alter table public.recipes   replica identity full;
alter table public.inventory replica identity full;
