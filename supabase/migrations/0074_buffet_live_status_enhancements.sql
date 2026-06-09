-- Extend buffet_live_status with kitchen communication fields
ALTER TABLE buffet_live_status
  ADD COLUMN IF NOT EXISTS note         text,
  ADD COLUMN IF NOT EXISTS eta_minutes  int,
  ADD COLUMN IF NOT EXISTS is_urgent    boolean DEFAULT false;
