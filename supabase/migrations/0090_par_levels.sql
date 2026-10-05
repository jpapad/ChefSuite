-- ============================================================
-- Chefsuite — Par levels for automatic order suggestions
-- par_level = the stock you want right after a delivery. When empty, the
-- app uses 2 × min_stock_level.
-- ============================================================

alter table public.inventory
  add column if not exists par_level numeric(12,3) check (par_level is null or par_level >= 0);
