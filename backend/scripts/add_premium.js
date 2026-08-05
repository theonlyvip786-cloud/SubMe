require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function addPremiumColumn() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;'
  });
  if (error) {
    console.error('Failed to add column via rpc, trying direct query if possible.', error);
    // Note: supabase-js doesn't natively support raw SQL queries.
    // If exec_sql RPC doesn't exist, we might have to create it or skip it
    // Wait, the user already uses Supabase. Supabase raw SQL can be run in the SQL editor online.
    // But since we have the service role key, we can try to see if it works.
  } else {
    console.log('Successfully added is_premium column.');
  }
}

addPremiumColumn();
