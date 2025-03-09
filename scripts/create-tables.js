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

// Run the SQL query using REST API
async function createTables() {
  console.log('Creating archived_bills table...');
  
  try {
    // Split the SQL into separate statements
    const statements = archivedBillsSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    // Execute each statement individually
    for (const statement of statements) {
      const { error } = await supabase.rpc('pg_query', { query: statement });
      
      if (error) {
        console.error(`Error executing statement: ${statement}`);
        console.error(error);
      } else {
        console.log(`Successfully executed: ${statement.substring(0, 50)}...`);
      }
    }
    
    console.log('Tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createTables(); 