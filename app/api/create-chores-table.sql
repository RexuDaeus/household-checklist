-- Create chores table if it doesn't exist
CREATE TABLE IF NOT EXISTS chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  lastReset TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CHORES TABLE PERMISSIONS
-- Enable RLS on the chores table
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Users can view chores" ON "chores";
DROP POLICY IF EXISTS "Users can insert chores" ON "chores";
DROP POLICY IF EXISTS "Users can update chores" ON "chores";
DROP POLICY IF EXISTS "Users can delete chores" ON "chores";

-- Create policies that allow users to work with chores
CREATE POLICY "Users can view chores" 
ON "chores"
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert chores" 
ON "chores"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by OR auth.uid() IS NOT NULL);

CREATE POLICY "Users can update chores" 
ON "chores"
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Users can delete chores" 
ON "chores"
FOR DELETE
TO authenticated
USING (true);

-- Grant permissions to authenticated users and service role
GRANT ALL ON chores TO authenticated;
GRANT ALL ON chores TO service_role; 