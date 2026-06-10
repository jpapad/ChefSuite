-- Weekly menu schedule: one menu per day-of-week per team
-- day_of_week follows ISO: 1=Monday … 7=Sunday

CREATE TABLE IF NOT EXISTS menu_weekly_schedule (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  menu_id     uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(team_id, day_of_week)
);

ALTER TABLE menu_weekly_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team members manage weekly schedule" ON menu_weekly_schedule;
CREATE POLICY "team members manage weekly schedule"
  ON menu_weekly_schedule FOR ALL TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM profiles WHERE id = auth.uid()
      UNION
      SELECT team_id FROM team_memberships WHERE user_id = auth.uid()
    )
  );

-- Update get_daily_menu: check weekly schedule first, fall back to daily_menu_id
CREATE OR REPLACE FUNCTION public.get_daily_menu(p_team_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu_id uuid;
BEGIN
  -- ISO day of week from current UTC time (1=Mon … 7=Sun)
  SELECT menu_id INTO v_menu_id
  FROM menu_weekly_schedule
  WHERE team_id     = p_team_id
    AND day_of_week = EXTRACT(ISODOW FROM NOW())::smallint;

  IF v_menu_id IS NULL THEN
    SELECT daily_menu_id INTO v_menu_id
    FROM teams WHERE id = p_team_id;
  END IF;

  RETURN v_menu_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_menu(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_daily_menu(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_daily_menu(uuid) TO authenticated;
