-- Add yield_pct to inventory items.
-- Yield % represents the usable proportion of an ingredient after trim/prep
-- (e.g. 80 = 80% for potatoes after peeling).
-- Used by the F&B engine to calculate gross purchase weight from net recipe quantity.

ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS yield_pct NUMERIC(5, 2)
    CHECK (yield_pct > 0 AND yield_pct <= 100);

COMMENT ON COLUMN inventory.yield_pct IS
  'Usable yield percentage (1–100). NULL = 100%. Example: 80 means 80% usable after trim/prep.';
