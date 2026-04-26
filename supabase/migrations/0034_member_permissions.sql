-- Add per-member module permissions
-- NULL = full access (owner always gets full access regardless)
-- text[] = list of allowed module keys

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions text[] DEFAULT NULL;

-- Function: only team owners can update a member's permissions
CREATE OR REPLACE FUNCTION update_member_permissions(
  member_id uuid,
  new_permissions text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'owner'
    AND team_id = (SELECT team_id FROM profiles WHERE id = member_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only team owners can update permissions';
  END IF;

  UPDATE profiles SET permissions = new_permissions WHERE id = member_id;
END;
$$;
