const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// 1. Setup Supabase with Service Role Key
const supabaseUrl = 'https://dzepmywtihvjgewdrynx.supabase.co';
const keyFile = fs.readFileSync('Credentials/supabase_servicerole_key', 'utf8');
const serviceRoleKey = keyFile.replace('service_role_key=', '').trim();

if (!serviceRoleKey) {
  console.error("Failed to read service role key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// 2. Read CSV
console.log('Reading CSV...');
let rawData;
try {
  rawData = fs.readFileSync('CSVs/initial_places_pull', 'utf8');
} catch (e) {
  console.error("Could not find CSV file at CSVs/initial_places_pull");
  process.exit(1);
}

const records = parse(rawData, { columns: true, skip_empty_lines: true, bom: true });
console.log(`Found ${records.length} total rows. Parsing and inserting...`);

async function run() {
  const CHUNK_SIZE = 500;
  
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    
    const businessesToInsert = [];
    const classificationsToInsert = [];
    
    for (const row of chunk) {
      // Validate Match Status (don't import if Business Name is missing)
      if (!row['Business Name'] || !row['Business Name'].trim()) continue;
      
      const id = crypto.randomUUID();
      
      // Map 'businesses' row
      businessesToInsert.push({
        id,
        name: row['Business Name'].trim(),
        address: row['Address'] ? row['Address'].trim() : null,
        website: row['Website'] ? row['Website'].trim() : null,
        google_types: row['Google Types'] ? row['Google Types'].split('|') : [],
        added_via: 'import',
        crm_stage: 'identified',
        review_status: 'unreviewed'
      });
      
      // Map 'business_classifications' row
      classificationsToInsert.push({
        business_id: id,
        vertical: row['Vertical'] ? row['Vertical'].trim() : null,
        category: row['Category'] ? row['Category'].trim() : null,
        business_type: row['Business Type'] ? row['Business Type'].trim() : null,
        gbp_confidence: row['GBP Confidence'] && row['GBP Confidence'].trim() !== '' ? row['GBP Confidence'] : null,
        match_status: row['Match Status'] ? row['Match Status'].trim() : null
      });
    }

    if (businessesToInsert.length > 0) {
      // Execute inserts
      const { error: bErr } = await supabase.from('businesses').insert(businessesToInsert);
      if (bErr) {
        console.error(`Error inserting businesses chunk ${i} - ${i + CHUNK_SIZE}:`, bErr);
        continue; // Try next chunk
      }
      
      const { error: cErr } = await supabase.from('business_classifications').insert(classificationsToInsert);
      if (cErr) {
        console.error(`Error inserting classifications chunk ${i} - ${i + CHUNK_SIZE}:`, cErr);
        // Warning: This creates orphaned businesses, but we log and continue
      }
    }
    
    process.stdout.write(`Inserted rows ${i} to ${Math.min(i + CHUNK_SIZE, records.length)}\n`);
  }
  
  console.log('\n✅ Data import complete!');
}

run().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
