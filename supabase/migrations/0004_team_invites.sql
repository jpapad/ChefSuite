-- ============================================================
-- Chefsuite — Team invites: invite teammates by email/token.
-- Creates the invites table, RLS policies, and two SECURITY
-- DEFINER RPCs (create + accept) so role checks and team
-- assignment stay server-side.
-- ============================================================

create table if not exists public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  email       text not null,
  token       uuid not null unique default gen_random_uuid(),
  invited_by  uuid not null references public.profiles(id) on delete cascade,
  role        public.user_role not null default 'cook',
  expires_at  timestamptz,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists team_invites_team_id_idx on public.team_invites(team_id);
create index if not exists team_invites_email_idx   on public.team_invites(lower(email));

alter table public.team_invites enable row level security;

-- Teammates can see their team's invites; owners/head_chefs can revoke.
-- (Role check for revoke happens inside the RLS expression.)
drop policy if exists invites_select_team on public.team_invites;
drop policy if exists invites_delete_team on public.team_invites;

create policy invites_select_team on public.team_invites
  for select to authenticated
  using (team_id = public.current_team_id());

create policy invites_delete_team on public.team_invites
  for delete to authenticated
  using (
    team_id = public.current_team_id()
    and exists (
      select 1 from public.profiles
       where id = auth.uid()
         and role in ('owner', 'head_chef')
    )
  );

-- No INSERT/UPDATE policy: forced through the SECURITY DEFINER RPC below.

-- ------------------------------------------------------------
-- create_team_invite: owner/head_chef only.
-- ------------------------------------------------------------
create or replace function public.create_team_invite(
  invite_email text,
  invite_role  public.user_role default 'cook'
) returns public.team_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  team uuid;
  caller_role public.user_role;
  row public.team_invites;
  trimmed text := btrim(invite_email);
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select team_id, role into team, caller_role
    from public.profiles where id = uid;

  if team is null then
    raise exception 'You must belong to a team to invite others'
      using errcode = '42501';
  end if;

  if caller_role not in ('owner', 'head_chef') then
    raise exception 'Only owners or head chefs can invite teammates'
      using errcode = '42501';
  end if;

  if trimmed = '' or position('@' in trimmed) = 0 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;

  insert into public.team_invites (team_id, email, invited_by, role, expires_at)
    values (team, lower(trimmed), uid, invite_role, now() + interval '14 days')
    returning * into row;

  return row;
end;
$$;

revoke all on function public.create_team_invite(text, public.user_role) from public;
grant execute on function public.create_team_invite(text, public.user_role) to authenticated;

-- ------------------------------------------------------------
-- accept_team_invite: sets caller's team + role atomically.
-- ------------------------------------------------------------
create or replace function public.accept_team_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.team_invites;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.profiles where id = uid and team_id is not null
  ) then
    raise exception 'You already belong to a team' using errcode = '23505';
  end if;

  select * into inv
    from public.team_invites
   where token = invite_token
   for update;

  if inv.id is null then
    raise exception 'Invite not found' using errcode = '22023';
  end if;

  if inv.accepted_at is not null then
    raise exception 'Invite has already been used' using errcode = '22023';
  end if;

  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'Invite has expired' using errcode = '22023';
  end if;

  update public.profiles
     set team_id = inv.team_id,
         role    = inv.role
   where id = uid;

  update public.team_invites
     set accepted_at = now()
   where id = inv.id;

  return inv.team_id;
end;
$$;

revoke all on function public.accept_team_invite(uuid) from public;
grant execute on function public.accept_team_invite(uuid) to authenticated;
