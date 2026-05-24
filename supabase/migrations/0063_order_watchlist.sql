-- Order Watchlist — chef quick-adds items during shift for later ordering

CREATE TABLE IF NOT EXISTS public.order_watchlist (
  id                 UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id            UUID           NOT NULL REFERENCES public.teams(id)      ON DELETE CASCADE,
  ingredient_id      UUID           NOT NULL REFERENCES public.inventory(id)  ON DELETE CASCADE,
  supplier_id        UUID                    REFERENCES public.suppliers(id)  ON DELETE SET NULL,
  requested_quantity NUMERIC(12,3)  NOT NULL DEFAULT 1 CHECK (requested_quantity > 0),
  notes              TEXT,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_watchlist_team"
  ON public.order_watchlist FOR ALL
  USING  (team_id = public.current_team_id())
  WITH CHECK (team_id = public.current_team_id());

CREATE INDEX IF NOT EXISTS order_watchlist_team_idx
  ON public.order_watchlist(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_watchlist_supplier_idx
  ON public.order_watchlist(team_id, supplier_id);
