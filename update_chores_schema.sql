-- First set null values to empty arrays
UPDATE chores SET assigned_to = NULL WHERE assigned_to IS NULL;

-- Convert the column type to uuid[]
ALTER TABLE chores 
  ALTER COLUMN assigned_to TYPE uuid[] 
  USING CASE 
    WHEN assigned_to IS NULL THEN '{}'::uuid[] 
    ELSE array[assigned_to]::uuid[] 
  END;

-- Add check constraint to ensure the array is not null
ALTER TABLE chores ALTER COLUMN assigned_to SET DEFAULT '{}'::uuid[];
