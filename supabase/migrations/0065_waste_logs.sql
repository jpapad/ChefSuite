-- Structured waste tracking with reason codes, inventory/dish linkage, and supplier credits
-- Replaces unstructured waste_entries with normalized waste_logs table

-- ── waste_logs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.waste_logs (
  id              UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id         UUID          NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  ingredient_id   UUID          REFERENCES public.inventory(id) ON DELETE SET NULL,
  menu_item_id    UUID          REFERENCES public.menu_items(id) ON DELETE SET NULL,
  quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit            TEXT          NOT NULL DEFAULT '',
  reason_code     TEXT          NOT NULL
    CHECK (reason_code IN ('spoilage', 'kitchen_mistake', 'supplier_damaged', 'customer_return')),
  supplier_id     UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
  calculated_cost NUMERIC(12,2),
  notes           TEXT,
  user_id         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.waste_logs IS 'Structured waste entries linked to inventory items or menu dishes.';
COMMENT ON COLUMN public.waste_logs.ingredient_id   IS 'Set for raw-ingredient waste mode.';
COMMENT ON COLUMN public.waste_logs.menu_item_id    IS 'Set for dish-waste mode; cost derived from recipe.';
COMMENT ON COLUMN public.waste_logs.reason_code     IS 'spoilage | kitchen_mistake | supplier_damaged | customer_return';
COMMENT ON COLUMN public.waste_logs.supplier_id     IS 'Populated when reason_code = supplier_damaged; triggers a supplier credit.';
COMMENT ON COLUMN public.waste_logs.calculated_cost IS 'qty * cost_per_unit (ingredient) or qty * cost_per_portion (dish).';

CREATE INDEX IF NOT EXISTS waste_logs_team_date_idx  ON public.waste_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS waste_logs_reason_idx     ON public.waste_logs(team_id, reason_code);
CREATE INDEX IF NOT EXISTS waste_logs_ingredient_idx ON public.waste_logs(ingredient_id) WHERE ingredient_id IS NOT NULL;

ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waste_logs_select" ON public.waste_logs
  FOR SELECT USING (team_id = public.current_team_id());
CREATE POLICY "waste_logs_insert" ON public.waste_logs
  FOR INSERT WITH CHECK (team_id = public.current_team_id());
CREATE POLICY "waste_logs_update" ON public.waste_logs
  FOR UPDATE USING (team_id = public.current_team_id());
CREATE POLICY "waste_logs_delete" ON public.waste_logs
  FOR DELETE USING (team_id = public.current_team_id());

-- ── supplier_credits ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.supplier_credits (
  id           UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id      UUID          NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  supplier_id  UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  waste_log_id UUID          REFERENCES public.waste_logs(id) ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description  TEXT,
  status       TEXT          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'applied')),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.supplier_credits IS 'Credit claims raised against suppliers for damaged goods.';
COMMENT ON COLUMN public.supplier_credits.waste_log_id IS 'Back-reference to the waste_log entry that triggered this credit.';
COMMENT ON COLUMN public.supplier_credits.status      IS 'pending → confirmed → applied lifecycle.';

CREATE INDEX IF NOT EXISTS supplier_credits_team_idx     ON public.supplier_credits(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_credits_supplier_idx ON public.supplier_credits(supplier_id);

ALTER TABLE public.supplier_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_credits_select" ON public.supplier_credits
  FOR SELECT USING (team_id = public.current_team_id());
CREATE POLICY "supplier_credits_insert" ON public.supplier_credits
  FOR INSERT WITH CHECK (team_id = public.current_team_id());
CREATE POLICY "supplier_credits_update" ON public.supplier_credits
  FOR UPDATE USING (team_id = public.current_team_id());
CREATE POLICY "supplier_credits_delete" ON public.supplier_credits
  FOR DELETE USING (team_id = public.current_team_id());
