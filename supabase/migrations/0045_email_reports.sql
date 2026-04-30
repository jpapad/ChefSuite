create table if not exists email_report_settings (
  team_id      uuid primary key references teams(id) on delete cascade,
  recipients   text[] not null default '{}',
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table email_report_settings enable row level security;

create policy "team owners can manage report settings"
  on email_report_settings for all
  using (team_id = (select team_id from profiles where id = auth.uid()))
  with check (team_id = (select team_id from profiles where id = auth.uid()));
