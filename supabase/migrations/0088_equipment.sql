-- ============================================================
-- Chefsuite — Equipment & maintenance
-- Fridges, ovens, hoods… with service schedule, technician contact and a log
-- of services / repairs / issues. Equipment can be linked to a HACCP location:
-- 3 out-of-range readings within 24h open an issue automatically.
-- ============================================================

create table if not exists public.equipment (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references public.teams(id) on delete cascade,
  name                   text not null,
  category               text not null default 'other'
                         check (category in ('fridge', 'freezer', 'oven', 'stove', 'dishwasher', 'hood', 'coffee', 'ice', 'other')),
  location               text,
  brand                  text,
  model                  text,
  serial_number          text,
  purchased_on           date,
  warranty_until         date,
  service_interval_days  integer check (service_interval_days is null or service_interval_days > 0),
  last_service_on        date,
  technician_name        text,
  technician_phone       text,
  haccp_location         text,
  status                 text not null default 'ok' check (status in ('ok', 'attention', 'out_of_order')),
  notes                  text,
  created_at             timestamptz not null default now()
);

create table if not exists public.equipment_logs (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams(id) on delete cascade,
  equipment_id  uuid not null references public.equipment(id) on delete cascade,
  kind          text not null check (kind in ('service', 'repair', 'issue', 'inspection')),
  title         text not null,
  description   text,
  cost          numeric(10,2),
  performed_on  date not null default current_date,
  resolved      boolean not null default true,
  resolved_at   timestamptz,
  auto          boolean not null default false,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.equipment      enable row level security;
alter table public.equipment_logs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='equipment' and policyname='team members manage equipment') then
    create policy "team members manage equipment" on public.equipment for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='equipment_logs' and policyname='team members manage equipment logs') then
    create policy "team members manage equipment logs" on public.equipment_logs for all
      using (team_id = public.current_team_id()) with check (team_id = public.current_team_id());
  end if;
end $$;

create index if not exists equipment_team_idx       on public.equipment(team_id, status);
create index if not exists equipment_logs_equip_idx on public.equipment_logs(equipment_id, performed_on desc);
create index if not exists equipment_logs_open_idx  on public.equipment_logs(team_id) where resolved = false;

-- ── A service log moves the "last service" date forward ─────────────────────
create or replace function public.equipment_log_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'service' then
    update public.equipment
       set last_service_on = greatest(coalesce(last_service_on, new.performed_on), new.performed_on)
     where id = new.equipment_id;
  end if;
  if new.kind = 'issue' and not new.resolved then
    update public.equipment set status = 'attention' where id = new.equipment_id and status = 'ok';
  end if;
  return new;
end;
$$;

drop trigger if exists equipment_log_after_insert on public.equipment_logs;
create trigger equipment_log_after_insert
  after insert on public.equipment_logs
  for each row execute function public.equipment_log_after_insert();

-- ── HACCP → equipment: repeated failed readings open an issue ───────────────
create or replace function public.haccp_check_equipment_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fails integer;
  v_equip record;
begin
  if new.temperature between new.min_temp and new.max_temp then
    return new;
  end if;

  select count(*) into v_fails
    from public.haccp_checks
   where team_id = new.team_id
     and location = new.location
     and created_at > now() - interval '24 hours'
     and (temperature < min_temp or temperature > max_temp);

  if v_fails < 3 then
    return new;
  end if;

  for v_equip in
    select id from public.equipment
     where team_id = new.team_id and haccp_location = new.location
  loop
    if not exists (
      select 1 from public.equipment_logs
       where equipment_id = v_equip.id and kind = 'issue' and resolved = false and auto = true
    ) then
      insert into public.equipment_logs (team_id, equipment_id, kind, title, description, resolved, auto)
      values (
        new.team_id, v_equip.id, 'issue',
        'HACCP: ' || v_fails || ' readings out of range in 24h',
        'Last reading ' || new.temperature || '°' || new.unit || ' (allowed ' || new.min_temp || '–' || new.max_temp || ')',
        false, true
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists haccp_check_equipment_alert on public.haccp_checks;
create trigger haccp_check_equipment_alert
  after insert on public.haccp_checks
  for each row execute function public.haccp_check_equipment_alert();
