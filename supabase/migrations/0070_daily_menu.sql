-- Daily menu: one menu per team marked as "today's menu"
-- Stored on the teams table for simplicity

alter table public.teams
  add column if not exists daily_menu_id uuid references public.menus(id) on delete set null;

-- Public function: given a team_id, return the daily menu id
create or replace function public.get_daily_menu(p_team_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select daily_menu_id from public.teams where id = p_team_id;
$$;

-- Allow anon to call it (needed for the public /menu/today page)
revoke all on function public.get_daily_menu(uuid) from public;
grant execute on function public.get_daily_menu(uuid) to anon;
grant execute on function public.get_daily_menu(uuid) to authenticated;

-- Allow authenticated users to update their team's daily_menu_id
-- (covered by existing team RLS — owner/admin can update teams row)
