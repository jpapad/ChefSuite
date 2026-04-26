-- ============================================================
-- Chefsuite — Atomic team creation RPC
-- Fixes the RLS chicken-and-egg where a new user cannot SELECT
-- the team they just INSERTed because their profile.team_id is
-- still NULL until after the follow-up UPDATE.
-- ============================================================

create or replace function public.create_team_for_current_user(team_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_team_id uuid;
  trimmed text := btrim(team_name);
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if trimmed = '' or length(trimmed) < 2 then
    raise exception 'Team name must be at least 2 characters'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.profiles where id = uid and team_id is not null
  ) then
    raise exception 'User already belongs to a team'
      using errcode = '23505';
  end if;

  insert into public.teams (name)
    values (trimmed)
    returning id into new_team_id;

  update public.profiles
     set team_id = new_team_id,
         role    = 'owner'
   where id = uid;

  return new_team_id;
end;
$$;

revoke all on function public.create_team_for_current_user(text) from public;
grant execute on function public.create_team_for_current_user(text) to authenticated;
