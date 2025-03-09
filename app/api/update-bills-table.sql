-- Check if the payee column exists in the bills table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'bills' 
        AND column_name = 'payee'
    ) THEN
        -- Add the payee column if it doesn't exist
        ALTER TABLE bills ADD COLUMN payee TEXT;
    END IF;
END
$$;

-- Update all existing bills to have a default payee if they don't have one
UPDATE bills SET payee = 'Unspecified' WHERE payee IS NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bills'; 