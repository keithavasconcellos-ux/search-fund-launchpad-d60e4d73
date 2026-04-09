const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://dzepmywtihvjgewdrynx.supabase.co';
const keyFile = fs.readFileSync('Credentials/supabase_servicerole_key', 'utf8');
const serviceRoleKey = keyFile.replace('service_role_key=', '').trim();
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const CHUNK_SIZE = 500;

async function run() {
  // 1. Wipe existing data (classifications first due to FK constraint, then businesses)
  console.log('🗑  Clearing existing data...');
  const { error: delClsErr } = await supabase.from('business_classifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delClsErr) { console.error('Error clearing classifications:', delClsErr.message); process.exit(1); }
  const { error: delBizErr } = await supabase.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delBizErr) { console.error('Error clearing businesses:', delBizErr.message); process.exit(1); }
  console.log('✅ Existing data cleared.\n');

  // 2. Read enriched CSV
  console.log('📂 Reading ne_places_enriched.csv...');
  const rawData = fs.readFileSync('CSVs/ne_places_enriched.csv', 'utf8');
  const records = parse(rawData, { columns: true, skip_empty_lines: true, bom: true });
  console.log(`Found ${records.length} rows. Inserting in chunks of ${CHUNK_SIZE}...\n`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);

    const businesses = [];
    const classifications = [];

    for (const row of chunk) {
      const name = row['Business Name']?.trim();
      if (!name) { skipped++; continue; }

      const id = crypto.randomUUID();

      const lat = row['lat'] && row['lat'].trim() !== '' ? parseFloat(row['lat']) : null;
      const lng = row['lng'] && row['lng'].trim() !== '' ? parseFloat(row['lng']) : null;

      businesses.push({
        id,
        name,
        address:         row['Address']?.trim()         || null,
        website:         row['Website']?.trim()          || null,
        google_types:    row['Google Types'] ? row['Google Types'].split('|') : [],
        lat,
        lng,
        geocode_status:  row['geocode_status']?.trim()  || null,
        country:         row['country']?.trim()          || null,
        state_abbr:      row['state_abbr']?.trim()       || null,
        state:           row['state']?.trim()            || null,
        county:          row['county']?.trim()           || null,
        added_via:       'import',
        crm_stage:       'identified',
        review_status:   'unreviewed',
      });

      classifications.push({
        business_id:    id,
        vertical:       row['Vertical']?.trim()        || null,
        category:       row['Category']?.trim()        || null,
        business_type:  row['Business Type']?.trim()   || null,
        gbp_confidence: row['GBP Confidence']?.trim()  || null,
        match_status:   row['Match Status']?.trim()    || null,
        // state/county stored here as extra metadata
        sf_score:      null,
      });
    }

    if (businesses.length === 0) continue;

    const { error: bizErr } = await supabase.from('businesses').insert(businesses);
    if (bizErr) {
      console.error(`❌ businesses chunk ${i}–${i+CHUNK_SIZE}: ${bizErr.message}`);
      // Try to continue with next chunk
      continue;
    }

    const { error: clsErr } = await supabase.from('business_classifications').insert(classifications);
    if (clsErr) {
      console.error(`⚠️  classifications chunk ${i}–${i+CHUNK_SIZE}: ${clsErr.message}`);
    }

    inserted += businesses.length;
    process.stdout.write(`  Rows ${i} → ${Math.min(i + CHUNK_SIZE, records.length)} ✓\n`);
  }

  console.log(`\n✅ Import complete! Inserted: ${inserted}, Skipped (no name): ${skipped}`);
  
  // 3. Report lat/lng coverage
  const withCoords = records.filter(r => r['lat']?.trim() && r['lng']?.trim()).length;
  console.log(`📍 ${withCoords} / ${records.length} rows have lat/lng coordinates (${((withCoords/records.length)*100).toFixed(1)}%)`);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
