-- Digital HACCP Logbook: appliances, temperature logs, cleaning tasks & logs

-- ── haccp_appliances ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.haccp_appliances (
  id         UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id    UUID    NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  type       TEXT    NOT NULL DEFAULT 'fridge'
               CHECK (type IN ('fridge', 'freezer')),
  min_temp   NUMERIC(5,1) NOT NULL,
  max_temp   NUMERIC(5,1) NOT NULL,
  sort_order INT     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT haccp_appliances_temp_range CHECK (min_temp < max_temp)
);

COMMENT ON TABLE  public.haccp_appliances IS 'Fridges/freezers registered for HACCP temperature monitoring.';
COMMENT ON COLUMN public.haccp_appliances.type     IS 'fridge (0°C–8°C typical) or freezer (-25°C–-18°C typical).';
COMMENT ON COLUMN public.haccp_appliances.min_temp IS 'Minimum acceptable temperature (°C).';
COMMENT ON COLUMN public.haccp_appliances.max_temp IS 'Maximum acceptable temperature (°C).';

CREATE INDEX IF NOT EXISTS haccp_appliances_team_idx ON public.haccp_appliances(team_id, sort_order);

ALTER TABLE public.haccp_appliances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "haccp_appliances_all" ON public.haccp_appliances FOR ALL
  USING (team_id = public.current_team_id())
  WITH CHECK (team_id = public.current_team_id());

-- ── haccp_temperature_logs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.haccp_temperature_logs (
  id                UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id           UUID         NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  appliance_id      UUID         NOT NULL REFERENCES public.haccp_appliances(id) ON DELETE CASCADE,
  temperature       NUMERIC(5,1) NOT NULL,
  shift             TEXT         NOT NULL CHECK (shift IN ('morning', 'night')),
  corrective_action TEXT,
  user_id           UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_date       DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (appliance_id, logged_date, shift)  -- one entry per appliance per shift per day
);

COMMENT ON TABLE  public.haccp_temperature_logs IS 'Daily temperature readings per appliance and shift.';
COMMENT ON COLUMN public.haccp_temperature_logs.shift             IS 'morning or night shift.';
COMMENT ON COLUMN public.haccp_temperature_logs.corrective_action IS 'Required when temperature is outside min/max range.';

CREATE INDEX IF NOT EXISTS haccp_temp_logs_team_date_idx    ON public.haccp_temperature_logs(team_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS haccp_temp_logs_appliance_idx    ON public.haccp_temperature_logs(appliance_id, logged_date DESC);

ALTER TABLE public.haccp_temperature_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "haccp_temp_logs_select" ON public.haccp_temperature_logs
  FOR SELECT USING (team_id = public.current_team_id());
CREATE POLICY "haccp_temp_logs_insert" ON public.haccp_temperature_logs
  FOR INSERT WITH CHECK (team_id = public.current_team_id());
CREATE POLICY "haccp_temp_logs_delete" ON public.haccp_temperature_logs
  FOR DELETE USING (team_id = public.current_team_id());

-- ── haccp_cleaning_tasks ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.haccp_cleaning_tasks (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  task_name  TEXT NOT NULL,
  frequency  TEXT NOT NULL DEFAULT 'daily'
               CHECK (frequency IN ('daily', 'weekly')),
  area       TEXT NOT NULL DEFAULT '',
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.haccp_cleaning_tasks IS 'Recurring cleaning task definitions (daily/weekly).';
COMMENT ON COLUMN public.haccp_cleaning_tasks.area IS 'Kitchen area, e.g. Μαγειρείο, Ψυγεία, Εξοπλισμός.';

CREATE INDEX IF NOT EXISTS haccp_cleaning_tasks_team_idx ON public.haccp_cleaning_tasks(team_id, frequency, sort_order);

ALTER TABLE public.haccp_cleaning_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "haccp_cleaning_tasks_all" ON public.haccp_cleaning_tasks FOR ALL
  USING (team_id = public.current_team_id())
  WITH CHECK (team_id = public.current_team_id());

-- ── haccp_cleaning_logs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.haccp_cleaning_logs (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  task_id     UUID        NOT NULL REFERENCES public.haccp_cleaning_tasks(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.haccp_cleaning_logs IS 'Completion records for HACCP cleaning tasks.';

CREATE INDEX IF NOT EXISTS haccp_cleaning_logs_team_date_idx ON public.haccp_cleaning_logs(team_id, logged_date DESC);
CREATE INDEX IF NOT EXISTS haccp_cleaning_logs_task_date_idx ON public.haccp_cleaning_logs(task_id, logged_date DESC);

ALTER TABLE public.haccp_cleaning_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "haccp_cleaning_logs_select" ON public.haccp_cleaning_logs
  FOR SELECT USING (team_id = public.current_team_id());
CREATE POLICY "haccp_cleaning_logs_insert" ON public.haccp_cleaning_logs
  FOR INSERT WITH CHECK (team_id = public.current_team_id());
CREATE POLICY "haccp_cleaning_logs_delete" ON public.haccp_cleaning_logs
  FOR DELETE USING (team_id = public.current_team_id());
