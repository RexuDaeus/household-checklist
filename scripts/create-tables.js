const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Read the SQL file content
const archivedBillsSQL = fs.readFileSync('./app/api/create-archived-bills-table.sql', 'utf8');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Run the SQL query
async function createTables() {
  console.log('Creating archived_bills table...');
  
  const { data, error } = await supabase.rpc('pgdump_exec', { 
    query: archivedBillsSQL 
  });
  
  if (error) {
    console.error('Error creating tables:', error);
    return;
  }
  
  console.log('Tables created successfully!');
}

createTables(); 