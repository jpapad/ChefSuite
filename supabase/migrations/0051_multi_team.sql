-- 0051: Multi-team support for executive_chef role

-- Add executive_chef to the role enum
alter type user_role add value if not exists 'executive_chef';

-- Add active_team_id to profiles so a user can "switch" their active team
alter table profiles
  add column if not exists active_team_id uuid references teams(id) on delete set null;

-- Team memberships: allows one user to belong to multiple teams
create table if not exists team_memberships (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  team_id     uuid        not null references teams(id) on delete cascade,
  role        user_role   not null default 'staff',
  invited_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique(user_id, team_id)
);

alter table team_memberships enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='view team memberships') then
    create policy "view team memberships"
      on team_memberships for select
      using (
        user_id = auth.uid() or
        team_id in (
          select team_id from profiles
          where id = auth.uid() and role::text in ('owner', 'executive_chef')
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='owners add team memberships') then
    create policy "owners add team memberships"
      on team_memberships for insert
      with check (
        team_id in (
          select team_id from profiles
          where id = auth.uid() and role::text in ('owner', 'executive_chef')
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='owners update team memberships') then
    create policy "owners update team memberships"
      on team_memberships for update
      using (
        team_id in (
          select team_id from profiles
          where id = auth.uid() and role::text in ('owner', 'executive_chef')
        )
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='delete team memberships') then
    create policy "delete team memberships"
      on team_memberships for delete
      using (
        user_id = auth.uid() or
        team_id in (
          select team_id from profiles
          where id = auth.uid() and role::text in ('owner', 'executive_chef')
        )
      );
  end if;
end $$;

create index if not exists team_memberships_user_idx on team_memberships(user_id);
create index if not exists team_memberships_team_idx on team_memberships(team_id);

-- Migrate existing profiles: ensure every user's primary team is in team_memberships
insert into team_memberships(user_id, team_id, role)
select id, team_id, role
from profiles
where team_id is not null
on conflict (user_id, team_id) do nothing;
