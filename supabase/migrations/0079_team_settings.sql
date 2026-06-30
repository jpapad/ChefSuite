-- 0079: Team-level settings (target food cost %)

create table if not exists team_settings (
  team_id                uuid primary key references teams(id) on delete cascade,
  target_food_cost_pct   numeric(5,2) not null default 30,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table team_settings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='team_settings' and policyname='team members can read settings'
  ) then
    create policy "team members can read settings"
      on team_settings for select
      using (team_id in (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename='team_settings' and policyname='owners manage settings'
  ) then
    create policy "owners manage settings"
      on team_settings for all
      using (
        team_id in (
          select team_id from profiles
          where id = auth.uid() and role::text in ('owner', 'executive_chef')
        )
      )
      with check (
        team_id in (
          select team_id from profiles
          where id = auth.uid() and role::text in ('owner', 'executive_chef')
        )
      );
  end if;
end $$;
