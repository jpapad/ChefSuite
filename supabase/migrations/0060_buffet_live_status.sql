-- Buffet Live Pulse — real-time status board for buffet ↔ kitchen communication.
-- One row per (team, menu_item). UPSERT keeps it idempotent.

CREATE TABLE IF NOT EXISTS public.buffet_live_status (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id           UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  menu_item_id      UUID        REFERENCES public.menu_items(id)     ON DELETE SET NULL,
  item_name         TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'full'
                                  CHECK (status IN ('full', 'low', 'empty')),
  vessel_request    BOOLEAN     NOT NULL DEFAULT FALSE,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by        UUID        REFERENCES auth.users(id)            ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, menu_item_id)
);

ALTER TABLE public.buffet_live_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buffet_live_status_team"
  ON public.buffet_live_status FOR ALL
  USING  (team_id = public.current_team_id())
  WITH CHECK (team_id = public.current_team_id());

-- Full replica identity so Realtime DELETE payloads carry the old row's team_id.
ALTER TABLE public.buffet_live_status REPLICA IDENTITY FULL;

-- Register with Supabase Realtime publication (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'buffet_live_status'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.buffet_live_status';
  END IF;
END $$;
