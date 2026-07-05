-- Grant table-level permissions for menu_scans so anon (public QR page)
-- can insert scans and authenticated users can read them.
-- The RLS policies in 0027_menu_scans.sql handle row-level filtering.
grant insert on public.menu_scans to anon;
grant insert on public.menu_scans to authenticated;
grant select on public.menu_scans to authenticated;
