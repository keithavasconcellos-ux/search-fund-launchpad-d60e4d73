const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://dzepmywtihvjgewdrynx.supabase.co';
const keyFile = fs.readFileSync('Credentials/supabase_servicerole_key', 'utf8');
const serviceRoleKey = keyFile.replace('service_role_key=', '').trim();
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

// We'll run raw SQL via rpc to add the new columns if they don't exist
async function run() {
  console.log('Adding geographic columns to businesses table...');
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      alter table businesses add column if not exists state_abbr text;
      alter table businesses add column if not exists state      text;
      alter table businesses add column if not exists county     text;
      alter table businesses add column if not exists country    text;
      alter table businesses add column if not exists geocode_status text;
    `
  });
  if (error) {
    // rpc exec_sql may not exist — we'll handle columns via direct ALTER in the import script
    console.log('RPC not available, will handle via import. Error:', error.message);
  } else {
    console.log('Columns added successfully.');
  }
}

run();
