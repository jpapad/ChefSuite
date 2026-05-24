-- Smart Inventory v2
-- 1. Two-level categorisation on inventory items (category / subcategory)
-- 2. ingredient_suppliers — many-to-many with price, SKU, lead time
-- 3. Supplier delivery schedule (delivery_days[], order_cutoff_days, order_cutoff_time)

-- ── 1. Category & Subcategory ─────────────────────────────────────────────────

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS category    TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

COMMENT ON COLUMN public.inventory.category    IS 'Top-level ingredient category, e.g. "Dairy", "Meat", "Vegetables"';
COMMENT ON COLUMN public.inventory.subcategory IS 'Sub-level category, e.g. "Hard Cheese", "Poultry", "Root Vegetables"';

CREATE INDEX IF NOT EXISTS inventory_category_idx    ON public.inventory(team_id, category);
CREATE INDEX IF NOT EXISTS inventory_subcategory_idx ON public.inventory(team_id, subcategory);

-- ── 2. ingredient_suppliers ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ingredient_suppliers (
  id                UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id           UUID          NOT NULL REFERENCES public.teams(id)     ON DELETE CASCADE,
  inventory_item_id UUID          NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  supplier_id       UUID          NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  purchase_price    NUMERIC(12,4) NOT NULL CHECK (purchase_price >= 0),
  supplier_sku      TEXT,
  lead_time_days    INTEGER       NOT NULL DEFAULT 1 CHECK (lead_time_days >= 0),
  is_preferred      BOOLEAN       NOT NULL DEFAULT FALSE,
  notes             TEXT,
  price_updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (inventory_item_id, supplier_id)
);

ALTER TABLE public.ingredient_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_suppliers_team"
  ON public.ingredient_suppliers FOR ALL
  USING  (team_id = public.current_team_id())
  WITH CHECK (team_id = public.current_team_id());

CREATE INDEX IF NOT EXISTS ingredient_suppliers_item_idx
  ON public.ingredient_suppliers(inventory_item_id);
CREATE INDEX IF NOT EXISTS ingredient_suppliers_supplier_idx
  ON public.ingredient_suppliers(supplier_id);

-- Enforce only one preferred supplier per ingredient (per team).
CREATE OR REPLACE FUNCTION public.enforce_single_preferred_supplier()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_preferred THEN
    UPDATE public.ingredient_suppliers
       SET is_preferred = FALSE
     WHERE inventory_item_id = NEW.inventory_item_id
       AND id <> NEW.id
       AND is_preferred = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_preferred_supplier ON public.ingredient_suppliers;
CREATE TRIGGER trg_single_preferred_supplier
  AFTER INSERT OR UPDATE OF is_preferred ON public.ingredient_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_preferred_supplier();

-- Auto-stamp updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ingredient_suppliers_updated_at ON public.ingredient_suppliers;
CREATE TRIGGER trg_ingredient_suppliers_updated_at
  BEFORE UPDATE ON public.ingredient_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Supplier delivery schedule ────────────────────────────────────────────

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS delivery_days     TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS order_cutoff_days INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS order_cutoff_time TIME    NOT NULL DEFAULT '17:00:00';

COMMENT ON COLUMN public.suppliers.delivery_days     IS 'Weekdays the supplier delivers: subset of {mon,tue,wed,thu,fri,sat,sun}';
COMMENT ON COLUMN public.suppliers.order_cutoff_days IS 'How many days before delivery an order must be placed (1 = previous day)';
COMMENT ON COLUMN public.suppliers.order_cutoff_time IS 'Latest time of day on the cutoff day to submit the order';
