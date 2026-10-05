-- ============================================================
-- Chefsuite — Staff certificates
-- Health cards (βιβλιάριο υγείας), HACCP / food-safety training, first aid,
-- fire safety… with expiry dates. Managers see everyone's; staff see their own.
-- Scans are kept in a private bucket, one folder per team.
-- ============================================================

create or replace function public.is_team_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and role::text in ('owner', 'executive_chef', 'head_chef')
  );
$$;

revoke all on function public.is_team_manager() from public;
grant execute on function public.is_team_manager() to authenticated;

create table if not exists public.staff_certificates (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('health_card', 'haccp', 'food_safety', 'first_aid', 'fire_safety', 'other')),
  title        text,
  issued_on    date,
  expires_on   date,
  doc_path     text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.staff_certificates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='staff_certificates' and policyname='certificates readable by managers and owner') then
    create policy "certificates readable by managers and owner"
      on public.staff_certificates for select
      using (team_id = public.current_team_id() and (public.is_team_manager() or user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='staff_certificates' and policyname='managers manage certificates') then
    create policy "managers manage certificates"
      on public.staff_certificates for all
      using (team_id = public.current_team_id() and public.is_team_manager())
      with check (team_id = public.current_team_id() and public.is_team_manager());
  end if;
end $$;

create index if not exists staff_certificates_team_idx on public.staff_certificates(team_id, expires_on);
create index if not exists staff_certificates_user_idx on public.staff_certificates(user_id);

-- ── Private bucket for scans ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-docs', 'staff-docs', false, 10485760, '{application/pdf,image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='staff_docs_select') then
    create policy staff_docs_select on storage.objects for select to authenticated
      using (bucket_id = 'staff-docs' and (storage.foldername(name))[1] = public.current_team_id()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='staff_docs_insert') then
    create policy staff_docs_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'staff-docs' and (storage.foldername(name))[1] = public.current_team_id()::text and public.is_team_manager());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='staff_docs_delete') then
    create policy staff_docs_delete on storage.objects for delete to authenticated
      using (bucket_id = 'staff-docs' and (storage.foldername(name))[1] = public.current_team_id()::text and public.is_team_manager());
  end if;
end $$;
