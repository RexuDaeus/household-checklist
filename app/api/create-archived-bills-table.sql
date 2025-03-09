-- Create archived_bills table if it doesn't exist
CREATE TABLE IF NOT EXISTS archived_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_bill_id UUID REFERENCES bills(id),
  payer_id UUID REFERENCES auth.users(id),
  bill_data JSONB NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on the archived_bills table
ALTER TABLE archived_bills ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Users can view archived bills" ON "archived_bills";
DROP POLICY IF EXISTS "Users can insert archived bills" ON "archived_bills";
DROP POLICY IF EXISTS "Users can update archived bills" ON "archived_bills";
DROP POLICY IF EXISTS "Users can delete archived bills" ON "archived_bills";

-- Create policies that allow users to work with archived bills
CREATE POLICY "Users can view archived bills" 
ON "archived_bills"
FOR SELECT
TO authenticated
USING (
  auth.uid() = payer_id OR 
  auth.uid() = (bill_data->>'created_by')::uuid
);

CREATE POLICY "Users can insert archived bills" 
ON "archived_bills"
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = (bill_data->>'created_by')::uuid
);

CREATE POLICY "Users can update archived bills" 
ON "archived_bills"
FOR UPDATE
TO authenticated
USING (
  auth.uid() = (bill_data->>'created_by')::uuid
);

CREATE POLICY "Users can delete archived bills" 
ON "archived_bills"
FOR DELETE
TO authenticated
USING (
  auth.uid() = (bill_data->>'created_by')::uuid
);

-- Grant permissions to authenticated users
GRANT ALL ON archived_bills TO authenticated; 