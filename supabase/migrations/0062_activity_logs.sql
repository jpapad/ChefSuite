-- Activity Logs — full audit trail for Admin
-- Records every Create / Update / Delete / Import action across the app.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id      UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL,
  action       TEXT        NOT NULL,   -- 'create' | 'update' | 'delete' | 'import' | 'restock' | 'receiving' | 'export'
  target_type  TEXT        NOT NULL,   -- 'inventory' | 'recipe' | 'supplier' | 'menu' | ...
  target_id    UUID,
  target_name  TEXT,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Team members can read their own team's logs; only the server (service role) writes.
CREATE POLICY "activity_logs_select"
  ON public.activity_logs FOR SELECT
  USING (team_id = public.current_team_id());

-- Inserts are done via the client with team_id check
CREATE POLICY "activity_logs_insert"
  ON public.activity_logs FOR INSERT
  WITH CHECK (team_id = public.current_team_id());

CREATE INDEX IF NOT EXISTS activity_logs_team_idx
  ON public.activity_logs(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_logs_target_idx
  ON public.activity_logs(team_id, target_type, target_id);
