create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users can read their own notifications
create policy "users read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

-- Team members can create notifications for teammates
create policy "team members insert notifications"
  on public.notifications for insert to authenticated
  with check (team_id = (select team_id from public.profiles where id = auth.uid()));

-- Users can mark their own notifications as read
create policy "users update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists notifications_user_idx  on public.notifications(user_id, created_at desc);
create index if not exists notifications_team_idx  on public.notifications(team_id);
