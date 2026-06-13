-- 0077: Time-limited team member accounts
-- Adds expires_at to team_memberships and a trigger to keep memberships in sync

ALTER TABLE team_memberships
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Auto-insert team_memberships row whenever profiles.team_id is set
-- (covers create_team_for_current_user + accept_team_invite paths)
CREATE OR REPLACE FUNCTION public.sync_team_membership_on_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND (OLD.team_id IS DISTINCT FROM NEW.team_id) THEN
    INSERT INTO team_memberships(user_id, team_id, role)
    VALUES (NEW.id, NEW.team_id, NEW.role)
    ON CONFLICT (user_id, team_id) DO UPDATE SET role = EXCLUDED.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_membership ON profiles;
CREATE TRIGGER trg_sync_membership
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_team_membership_on_profile_update();

-- Allow owners to update expires_at on memberships they own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='team_memberships' AND policyname='owners update expiry'
  ) THEN
    CREATE POLICY "owners update expiry"
      ON team_memberships FOR UPDATE
      USING (
        team_id IN (
          SELECT team_id FROM profiles
          WHERE id = auth.uid() AND role::text IN ('owner', 'executive_chef')
        )
      );
  END IF;
END $$;
