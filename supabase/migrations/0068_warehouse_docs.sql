-- ── Warehouse document storage bucket ────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'warehouse-docs',
  'warehouse-docs',
  false,
  52428800,  -- 50 MB
  '{application/pdf,image/jpeg,image/png,image/webp}'
)
on conflict (id) do nothing;

-- Storage policies
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='wh_docs_select') then
    create policy wh_docs_select on storage.objects for select to authenticated using (bucket_id = 'warehouse-docs');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='wh_docs_insert') then
    create policy wh_docs_insert on storage.objects for insert to authenticated with check (bucket_id = 'warehouse-docs');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='wh_docs_delete') then
    create policy wh_docs_delete on storage.objects for delete to authenticated using (bucket_id = 'warehouse-docs');
  end if;
end $$;

-- ── Schema additions ──────────────────────────────────────────────────────────
alter table wh_orders add column if not exists invoice_pdf_path text;
alter table wh_supplier_catalogs add column if not exists pdf_path text;
