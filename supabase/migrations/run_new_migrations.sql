-- Run this in the Supabase SQL Editor to apply all new migrations.
-- All statements use IF NOT EXISTS so it's safe to run multiple times.

-- ── 0041: Recipe Comments ────────────────────────────────────────────────────
create table if not exists recipe_comments (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  content     text not null,
  created_at  timestamptz not null default now()
);

alter table recipe_comments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recipe_comments' and policyname='team members can read recipe comments') then
    create policy "team members can read recipe comments"
      on recipe_comments for select
      using (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recipe_comments' and policyname='team members can insert recipe comments') then
    create policy "team members can insert recipe comments"
      on recipe_comments for insert
      with check (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recipe_comments' and policyname='comment authors can delete own comments') then
    create policy "comment authors can delete own comments"
      on recipe_comments for delete
      using (author_id = auth.uid());
  end if;
end $$;

create index if not exists recipe_comments_recipe_idx on recipe_comments(recipe_id, created_at desc);

-- ── 0042: HACCP Reminders ────────────────────────────────────────────────────
create table if not exists haccp_reminders (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references teams(id) on delete cascade,
  location     text not null,
  label        text not null,
  frequency_h  numeric(5,1) not null default 4,
  next_due     timestamptz not null,
  assignee_id  uuid references auth.users(id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table haccp_reminders enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='haccp_reminders' and policyname='team members can manage haccp reminders') then
    create policy "team members can manage haccp reminders"
      on haccp_reminders for all
      using (team_id = (select team_id from profiles where id = auth.uid()))
      with check (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

create index if not exists haccp_reminders_team_idx on haccp_reminders(team_id, active, next_due);

-- ── 0043: Recipe Variations ──────────────────────────────────────────────────
alter table recipes
  add column if not exists parent_recipe_id uuid references recipes(id) on delete set null,
  add column if not exists variation_label  text;

create index if not exists recipes_parent_idx on recipes(parent_recipe_id)
  where parent_recipe_id is not null;

-- ── 0044: Recipe Nutrition ───────────────────────────────────────────────────
alter table recipes
  add column if not exists calories   numeric(7,1),
  add column if not exists protein_g  numeric(7,2),
  add column if not exists carbs_g    numeric(7,2),
  add column if not exists fat_g      numeric(7,2),
  add column if not exists fiber_g    numeric(7,2),
  add column if not exists sodium_mg  numeric(8,1);

-- ── 0045: Email Report Settings ──────────────────────────────────────────────
create table if not exists email_report_settings (
  team_id      uuid primary key references teams(id) on delete cascade,
  recipients   text[] not null default '{}',
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table email_report_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='email_report_settings' and policyname='team owners can manage report settings') then
    create policy "team owners can manage report settings"
      on email_report_settings for all
      using (team_id = (select team_id from profiles where id = auth.uid()))
      with check (team_id = (select team_id from profiles where id = auth.uid()));
  end if;
end $$;

-- ── 0046: Profile Language Preference ────────────────────────────────────────
alter table profiles
  add column if not exists preferred_lang text not null default 'en'
  check (preferred_lang in ('en', 'el', 'bg'));

-- ── 0047: Inventory Barcode ───────────────────────────────────────────────────
alter table inventory
  add column if not exists barcode text;

create index if not exists inventory_barcode_idx
  on inventory(team_id, barcode)
  where barcode is not null;

-- ── 0048: POS Integration ─────────────────────────────────────────────────────
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

do $$ begin
  if not exists (select 1 from pg_policies where tablename='pos_transactions' and policyname='service role can insert pos transactions') then
    create policy "service role can insert pos transactions"
      on pos_transactions for insert
      with check (true);
  end if;
end $$;

create index if not exists pos_transactions_team_date_idx
  on pos_transactions(team_id, transacted_at desc);

-- ── 0049: Push Subscriptions ─────────────────────────────────────────────────
create table if not exists push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  team_id     uuid        not null,
  endpoint    text        not null,
  p256dh      text        not null,
  auth_key    text        not null,
  created_at  timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='push_subscriptions' and policyname='users manage own push subscriptions') then
    create policy "users manage own push subscriptions"
      on push_subscriptions for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ── 0051: Multi-team support ─────────────────────────────────────────────────
alter type user_role add value if not exists 'executive_chef';

alter table profiles
  add column if not exists active_team_id uuid references teams(id) on delete set null;

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
        team_id in (select team_id from profiles where id = auth.uid() and role::text in ('owner', 'executive_chef'))
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='owners add team memberships') then
    create policy "owners add team memberships"
      on team_memberships for insert
      with check (
        team_id in (select team_id from profiles where id = auth.uid() and role::text in ('owner', 'executive_chef'))
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='owners update team memberships') then
    create policy "owners update team memberships"
      on team_memberships for update
      using (
        team_id in (select team_id from profiles where id = auth.uid() and role::text in ('owner', 'executive_chef'))
      );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='team_memberships' and policyname='delete team memberships') then
    create policy "delete team memberships"
      on team_memberships for delete
      using (
        user_id = auth.uid() or
        team_id in (select team_id from profiles where id = auth.uid() and role::text in ('owner', 'executive_chef'))
      );
  end if;
end $$;

create index if not exists team_memberships_user_idx on team_memberships(user_id);
create index if not exists team_memberships_team_idx on team_memberships(team_id);

insert into team_memberships(user_id, team_id, role)
select id, team_id, role from profiles where team_id is not null
on conflict (user_id, team_id) do nothing;

-- ── 0050: Chat Channels + Direct Messages ────────────────────────────────────
alter table team_messages add column if not exists channel text not null default 'general';

create index if not exists team_messages_channel_idx
  on team_messages(team_id, channel, created_at);

create table if not exists direct_messages (
  id           uuid        primary key default gen_random_uuid(),
  team_id      uuid        not null,
  sender_id    uuid        not null references auth.users(id) on delete cascade,
  recipient_id uuid        not null references auth.users(id) on delete cascade,
  content      text        not null check (char_length(content) between 1 and 4000),
  created_at   timestamptz not null default now()
);

alter table direct_messages enable row level security;

create index if not exists direct_messages_team_pair_idx
  on direct_messages(team_id, sender_id, recipient_id, created_at);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'direct_messages'
    and policyname = 'team members can access their direct messages'
  ) then
    create policy "team members can access their direct messages"
      on direct_messages for all
      using (auth.uid() = sender_id or auth.uid() = recipient_id)
      with check (auth.uid() = sender_id);
  end if;
end $$;

-- ── 0052: Shift Handover Notes ────────────────────────────────────────────────
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
