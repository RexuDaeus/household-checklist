-- First, drop the foreign key constraint
ALTER TABLE chores DROP CONSTRAINT IF EXISTS chores_assigned_to_fkey;

-- Set null values to empty arrays
UPDATE chores SET assigned_to = NULL WHERE assigned_to IS NULL;

-- Convert the column type to uuid[]
ALTER TABLE chores 
  ALTER COLUMN assigned_to TYPE uuid[] 
  USING CASE 
    WHEN assigned_to IS NULL THEN '{}'::uuid[] 
    ELSE array[assigned_to]::uuid[] 
  END;

-- Set default value to empty array
ALTER TABLE chores ALTER COLUMN assigned_to SET DEFAULT '{}'::uuid[];

-- Now, we need to create a custom constraint that checks each element in the array
-- instead of the traditional foreign key constraint
CREATE OR REPLACE FUNCTION check_chore_assignees()
RETURNS TRIGGER AS $$
BEGIN
  -- Check that each assignee ID exists in the profiles table
  IF EXISTS (
    SELECT 1
    FROM unnest(NEW.assigned_to) AS assignee_id
    LEFT JOIN profiles ON profiles.id = assignee_id
    WHERE profiles.id IS NULL AND assignee_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Assigned user does not exist in profiles table';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run this check on insert or update
DROP TRIGGER IF EXISTS check_chore_assignees_trigger ON chores;
CREATE TRIGGER check_chore_assignees_trigger
BEFORE INSERT OR UPDATE ON chores
FOR EACH ROW
EXECUTE FUNCTION check_chore_assignees();
