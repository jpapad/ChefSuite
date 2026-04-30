-- 0052: Shift Handover Notes

create table if not exists handover_notes (
  id              uuid        primary key default gen_random_uuid(),
  team_id         uuid        not null references teams(id) on delete cascade,
  from_user_id    uuid        not null references auth.users(id) on delete cascade,
  to_user_id      uuid        not null references auth.users(id) on delete cascade,
  content         text        not null check (char_length(content) between 1 and 2000),
  priority        text        not null default 'medium'
                  check (priority in ('low', 'medium', 'high')),
  acknowledged    boolean     not null default false,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

alter table handover_notes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='handover_notes' and policyname='team members view own handover notes') then
    create policy "team members view own handover notes"
      on handover_notes for select
      using (
        team_id = (select team_id from profiles where id = auth.uid()) and
        (from_user_id = auth.uid() or to_user_id = auth.uid())
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='handover_notes' and policyname='team members insert handover notes') then
    create policy "team members insert handover notes"
      on handover_notes for insert
      with check (
        team_id = (select team_id from profiles where id = auth.uid()) and
        from_user_id = auth.uid()
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='handover_notes' and policyname='recipient can acknowledge handover notes') then
    create policy "recipient can acknowledge handover notes"
      on handover_notes for update
      using (to_user_id = auth.uid())
      with check (to_user_id = auth.uid());
  end if;
end $$;

create index if not exists handover_notes_team_idx on handover_notes(team_id, created_at desc);
create index if not exists handover_notes_to_user_idx on handover_notes(to_user_id, acknowledged);
