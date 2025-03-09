# Fixing Chores Table in Supabase

To fix the issues with the chores table and its permissions, follow these steps:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Create a new query and paste the following SQL code
4. Run the query

```sql
-- First, check if the chores table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'chores'
);

-- If the table doesn't exist, create it
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
```

## Verifying Table Structure

After running the SQL above, run this query to verify the structure of the chores table:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'chores';
```

This should fix the issues with creating and managing chores in your application. 