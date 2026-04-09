/**
 * update_gbp_classifications.cjs
 *
 * Updates existing rows in `business_classifications` from ne_places_gbp_ScrapedClass.csv.
 * Matches by (name + address) → business_id, then does explicit UPDATE on the
 * existing classification row.
 *
 * Updates ALL fields including:
 *   • vertical, category, business_type (overwrite with new scraped values)
 *   • gbp_confidence, match_status
 *   • New fields: primary_gbp_category, business_description, services_offered,
 *                 customer_type, geographic_scope, industry_keywords,
 *                 years_in_business, contact_info, extraction_status,
 *                 classification_confidence, match_method, match_signals
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dzepmywtihvjgewdrynx.supabase.co';
const keyFile = fs.readFileSync('Credentials/supabase_servicerole_key', 'utf8');
const SERVICE_KEY = keyFile.replace('service_role_key=', '').trim();
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CHUNK_SIZE = 150; // RPC batch size for parallel updates

function normalize(s) {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function orNull(v) {
  return v?.trim() || null;
}

// DB CHECK constraint requires title-case: 'High' | 'Medium' | 'Low'
function titleCase(v) {
  const s = v?.trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Strip encoding artifacts from match_status (e.g. 'Classified \xc2\x97 Low Confidence')
function cleanMatchStatus(v) {
  const s = v?.trim();
  if (!s) return null;
  // Replace any non-ASCII garbage and normalize whitespace
  return s.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim() || null;
}

// ── 1. Load all businesses ─────────────────────────────────────────────────
async function loadAllBusinesses() {
  console.log('📥 Loading all businesses from Supabase...');
  let page = 0;
  const all = [];
  while (true) {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, address')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error('Error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all.push(...data);
    page++;
    if (data.length < 1000) break;
  }
  console.log(`✅ Loaded ${all.length} businesses.`);
  return all;
}

// ── 2. Build name+address → business_id lookup ────────────────────────────
function buildLookup(businesses) {
  const map = new Map();
  for (const b of businesses) {
    const key = normalize(b.name) + '|' + normalize(b.address);
    map.set(key, b.id);
  }
  return map;
}

// ── 3. Run UPDATE for each matched business_id ────────────────────────────
async function updateChunk(updates) {
  // Supabase doesn't support batch UPDATE natively, so we fire them in parallel.
  const results = await Promise.allSettled(
    updates.map(({ businessId, payload }) =>
      supabase
        .from('business_classifications')
        .update(payload)
        .eq('business_id', businessId)
    )
  );

  let errCount = 0;
  for (const r of results) {
    if (r.status === 'rejected' || r.value?.error) {
      const msg = r.status === 'rejected' ? r.reason : r.value.error.message;
      console.error('  ⚠️  Update error:', msg);
      errCount++;
    }
  }
  return errCount;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function run() {
  const businesses = await loadAllBusinesses();
  const bizMap = buildLookup(businesses);

  console.log('\n📂 Reading ne_places_gbp_ScrapedClass.csv...');
  const raw = fs.readFileSync('CSVs/ne_places_gbp_ScrapedClass.csv', 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
  console.log(`Found ${records.length} rows in CSV.\n`);

  const updates = [];
  let unmatched = 0;

  for (const row of records) {
    const name    = row['Business Name']?.trim();
    const address = row['Address']?.trim();
    if (!name) { unmatched++; continue; }

    const key        = normalize(name) + '|' + normalize(address);
    const businessId = bizMap.get(key);

    if (!businessId) {
      unmatched++;
      continue;
    }

    updates.push({
      businessId,
      payload: {
        // ── Core classification fields (overwrite with new scraped values) ──
        vertical:                  orNull(row['Vertical']),
        category:                  orNull(row['Category']),
        business_type:             orNull(row['Business Type']),
        gbp_confidence:            titleCase(row['GBP Confidence']),   // must be High/Medium/Low
        match_status:              cleanMatchStatus(row['Match Status']),

        // ── New GBP-scraped enrichment fields ──────────────────────────────
        primary_gbp_category:      orNull(row['primary_gbp_category']),
        business_description:      orNull(row['business_description']),
        services_offered:          orNull(row['services_offered']),
        customer_type:             orNull(row['customer_type']),
        geographic_scope:          orNull(row['geographic_scope']),
        industry_keywords:         orNull(row['industry_keywords']),
        years_in_business:         orNull(row['years_in_business']),
        contact_info:              orNull(row['contact_info']),
        extraction_status:         orNull(row['extraction_status']),
        classification_confidence: orNull(row['classification_confidence']),
        match_method:              orNull(row['match_method']),
        match_signals:             orNull(row['match_signals']),
      },
    });
  }

  console.log(`🔍 Match results: ${updates.length} matched, ${unmatched} unmatched (no business row found)`);
  console.log(`\n📤 Updating business_classifications in chunks of ${CHUNK_SIZE}...\n`);

  let totalErrors = 0;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const errCount = await updateChunk(chunk);
    totalErrors += errCount;
    const end = Math.min(i + CHUNK_SIZE, updates.length);
    console.log(`  Rows ${i}–${end} ✓ ${errCount > 0 ? `(${errCount} errors)` : ''}`);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`✅ Complete.`);
  console.log(`   Updated:   ${updates.length - totalErrors} rows`);
  console.log(`   Errors:    ${totalErrors} rows`);
  console.log(`   Unmatched: ${unmatched} rows (not in businesses table)`);
  console.log('══════════════════════════════════════════════');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
