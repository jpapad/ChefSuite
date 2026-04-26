-- ============================================================
-- Chefsuite — Realtime for team membership changes
-- Enables live updates on the Team page when invites are
-- created/revoked/accepted or when profiles join/leave.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'team_invites'
  ) then
    alter publication supabase_realtime add table public.team_invites;
  end if;
end $$;

alter table public.profiles     replica identity full;
alter table public.team_invites replica identity full;
