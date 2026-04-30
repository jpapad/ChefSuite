-- POS Integration: settings per team + incoming transactions from Viva/Square

-- Settings: one row per team, stores provider config and the webhook token
create table if not exists pos_settings (
  team_id        uuid primary key references teams(id) on delete cascade,
  provider       text not null check (provider in ('viva', 'square')),
  team_token     text not null unique default gen_random_uuid()::text,
  webhook_secret text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table pos_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='pos_settings' and policyname='team members can manage pos settings') then
    create policy "team members can manage pos settings"
      on pos_settings for all
      using (team_id = (select team_id from profiles where id = auth.uid()))
      with check (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

-- Transactions: each incoming POS payment stored here
create table if not exists pos_transactions (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references teams(id) on delete cascade,
  provider       text not null check (provider in ('viva', 'square')),
  external_id    text not null,
  amount         numeric(10,2) not null,
  currency       text not null default 'EUR',
  status         text not null default 'completed',
  transacted_at  timestamptz not null,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  unique (provider, external_id)
);

alter table pos_transactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='pos_transactions' and policyname='team members can read pos transactions') then
    create policy "team members can read pos transactions"
      on pos_transactions for select
      using (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

-- Service role can insert (used by the edge function with service_role key)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='pos_transactions' and policyname='service role can insert pos transactions') then
    create policy "service role can insert pos transactions"
      on pos_transactions for insert
      with check (true);
  end if;
end $$;

create index if not exists pos_transactions_team_date_idx
  on pos_transactions(team_id, transacted_at desc);
