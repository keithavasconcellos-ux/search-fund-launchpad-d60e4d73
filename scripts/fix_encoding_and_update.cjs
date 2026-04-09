/**
 * fix_encoding_and_update.cjs
 *
 * Strategy:
 *  1. Strip encoding corruption from CSV names/addresses (ÃÂ → proper chars)
 *  2. Try exact match with fixed string (should catch ~99% of the 2,522)
 *  3. For any still unmatched, fall back to Jaro-Winkler fuzzy match (threshold 0.88)
 *  4. Update business_classifications for all HIGH-confidence matches
 *  5. Print a summary of what was and wasn't updated
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dzepmywtihvjgewdrynx.supabase.co';
const key = fs.readFileSync('Credentials/supabase_servicerole_key', 'utf8')
  .replace('service_role_key=', '').trim();
const supabase = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

const CHUNK_SIZE = 150;

// ── Encoding fixers ───────────────────────────────────────────────────────────

// Fix double-encoded UTF-8 sequences produced by latin1-read-as-utf8
function fixEncoding(s) {
  if (!s) return '';
  return s
    .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ãª/g, 'ê').replace(/Ã«/g, 'ë')
    .replace(/Ã /g, 'à').replace(/Ã¢/g, 'â').replace(/Ã¤/g, 'ä')
    .replace(/Ã®/g, 'î').replace(/Ã¯/g, 'ï')
    .replace(/Ã´/g, 'ô').replace(/Ã¶/g, 'ö')
    .replace(/Ã»/g, 'û').replace(/Ã¹/g, 'ù').replace(/Ã¼/g, 'ü')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã‰/g, 'É').replace(/Ã‡/g, 'Ç').replace(/Ã€/g, 'À')
    .replace(/Ã‹/g, 'Ë').replace(/Ã\x8e/g, 'Î').replace(/Ã\x94/g, 'Ô')
    .replace(/Ã\x8a/g, 'Ê').replace(/Ã\x9b/g, 'Û').replace(/Ã\x99/g, 'Ù')
    .replace(/Ã¿/g, 'ÿ').replace(/Ã±/g, 'ñ')
    .replace(/ÃÂ/g, '')   // cleanup any residual artifacts
    .replace(/Â/g, '')    // stray Â markers
    .trim();
}

function normalize(s) {
  return fixEncoding(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Jaro-Winkler (for fuzzy fallback) ────────────────────────────────────────

function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  const l1 = s1.length, l2 = s2.length;
  if (!l1 || !l2) return 0;
  const dist = Math.floor(Math.max(l1, l2) / 2) - 1;
  const m1 = new Array(l1).fill(false), m2 = new Array(l2).fill(false);
  let matches = 0, trans = 0;
  for (let i = 0; i < l1; i++) {
    for (let j = Math.max(0, i - dist); j < Math.min(i + dist + 1, l2); j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = m2[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) trans++;
    k++;
  }
  const jaro = (matches/l1 + matches/l2 + (matches - trans/2)/matches) / 3;
  let pfx = 0;
  for (let i = 0; i < Math.min(4, l1, l2); i++) { if (s1[i] === s2[i]) pfx++; else break; }
  return jaro + pfx * 0.1 * (1 - jaro);
}

function orNull(v) { return fixEncoding(v ?? '').trim() || null; }

function titleCase(v) {
  const s = fixEncoding(v ?? '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : null;
}

function cleanMatchStatus(v) {
  return fixEncoding(v ?? '').replace(/[^\x20-\x7EÀ-ÿ]/g, '').replace(/\s+/g, ' ').trim() || null;
}

// ── Load businesses ───────────────────────────────────────────────────────────

async function loadAllBusinesses() {
  console.log('📥 Loading all businesses from Supabase...');
  let page = 0, all = [];
  while (true) {
    const { data, error } = await supabase
      .from('businesses').select('id,name,address')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || !data.length) break;
    all.push(...data); page++;
    if (data.length < 1000) break;
  }
  console.log(`✅ Loaded ${all.length} businesses.\n`);
  return all;
}

// ── Update chunks ─────────────────────────────────────────────────────────────

async function updateChunk(updates) {
  const results = await Promise.allSettled(
    updates.map(({ businessId, payload }) =>
      supabase.from('business_classifications').update(payload).eq('business_id', businessId)
    )
  );
  return results.filter(r => r.status === 'rejected' || r.value?.error).length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const businesses = await loadAllBusinesses();

  // Build two lookup maps: (1) exact normalized, (2) name-only for fuzzy
  const exactMap = new Map();   // normName|normAddr → business_id
  const nameMap  = new Map();   // normName → [{id, normAddr}]

  for (const b of businesses) {
    const nName = normalize(b.name);
    const nAddr = normalize(b.address ?? '');
    exactMap.set(nName + '|' + nAddr, b.id);
    if (!nameMap.has(nName)) nameMap.set(nName, []);
    nameMap.get(nName).push({ id: b.id, normAddr: nAddr, rawName: b.name, rawAddr: b.address });
  }

  // Pre-compute DB norm for fuzzy fallback
  const dbNorm = businesses.map(b => ({
    id: b.id,
    rawName: b.name,
    rawAddr: b.address,
    normName: normalize(b.name),
    normAddr: normalize(b.address ?? ''),
  }));

  console.log('📂 Reading CSV...');
  const raw = fs.readFileSync('CSVs/ne_places_gbp_ScrapedClass.csv', 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, bom: true });
  console.log(`Found ${records.length} rows.\n`);

  let exactOrig = 0, exactFixed = 0, fuzzyHigh = 0, fuzzyMed = 0, noMatch = 0;

  const updates = [];
  const noMatchRows = [];

  for (const row of records) {
    const rawName = row['Business Name'] ?? '';
    const rawAddr = row['Address'] ?? '';

    // ── Phase 1: original exact match (already done for 15,817 rows, skip) ──
    const nNameOrig = rawName.trim().toLowerCase().replace(/\s+/g, ' ');
    const nAddrOrig = rawAddr.trim().toLowerCase().replace(/\s+/g, ' ');
    if (exactMap.has(nNameOrig + '|' + nAddrOrig)) {
      exactOrig++;
      continue; // already updated in first pass
    }

    // ── Phase 2: encoding-fixed exact match ───────────────────────────────
    const nNameFixed = normalize(rawName);
    const nAddrFixed = normalize(rawAddr);
    let businessId = exactMap.get(nNameFixed + '|' + nAddrFixed);
    let matchMethod = 'encoding_fix_exact';
    let confidence = 'VERY_HIGH';

    // ── Phase 3: name-only exact match (address slight diff) ──────────────
    if (!businessId) {
      const candidates = nameMap.get(nNameFixed);
      if (candidates?.length === 1) {
        businessId = candidates[0].id;
        matchMethod = 'name_exact_addr_fuzzy';
        confidence = 'HIGH';
      } else if (candidates?.length > 1) {
        // pick best address match
        let best = null, bestSim = 0;
        for (const c of candidates) {
          const sim = jaroWinkler(nAddrFixed, c.normAddr);
          if (sim > bestSim) { bestSim = sim; best = c; }
        }
        if (best && bestSim > 0.7) {
          businessId = best.id;
          matchMethod = 'name_exact_addr_fuzzy';
          confidence = bestSim >= 0.9 ? 'VERY_HIGH' : 'HIGH';
        }
      }
    }

    // ── Phase 4: full Jaro-Winkler fuzzy ─────────────────────────────────
    if (!businessId) {
      let bestScore = 0, bestDb = null;
      const token = nNameFixed.split(' ')[0];
      // Only scan rows sharing first token (huge speed-up)
      const candidates = dbNorm.filter(b => b.normName.startsWith(token));
      const pool = candidates.length > 5 ? candidates : dbNorm;

      for (const b of pool) {
        const nameSim = jaroWinkler(nNameFixed, b.normName);
        if (nameSim < 0.82) continue;
        const addrSim = nAddrFixed && b.normAddr
          ? jaroWinkler(nAddrFixed, b.normAddr) : 0.5;
        const combined = nameSim * 0.7 + addrSim * 0.3;
        if (combined > bestScore) { bestScore = combined; bestDb = b; }
      }

      if (bestScore >= 0.92) {
        businessId = bestDb.id;
        matchMethod = 'fuzzy';
        confidence = bestScore >= 0.96 ? 'VERY_HIGH' : 'HIGH';
        fuzzyHigh++;
      } else if (bestScore >= 0.85) {
        businessId = bestDb.id;
        matchMethod = 'fuzzy_medium';
        confidence = 'MEDIUM';
        fuzzyMed++;
      } else {
        noMatch++;
        noMatchRows.push({ name: fixEncoding(rawName), address: fixEncoding(rawAddr), score: bestScore.toFixed(3) });
        continue;
      }
    } else {
      if (matchMethod === 'encoding_fix_exact') exactFixed++;
      else fuzzyHigh++;
    }

    // ── Build update payload ───────────────────────────────────────────────
    updates.push({
      businessId,
      confidence,
      payload: {
        vertical:                  orNull(row['Vertical']),
        category:                  orNull(row['Category']),
        business_type:             orNull(row['Business Type']),
        gbp_confidence:            titleCase(row['GBP Confidence']),
        match_status:              cleanMatchStatus(row['Match Status']),
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

  console.log('═══════════════════════════════════════════════');
  console.log('MATCH SUMMARY (2,522 previously unmatched rows)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Encoding-fix exact match:  ${exactFixed}`);
  console.log(`  Fuzzy HIGH confidence:     ${fuzzyHigh}`);
  console.log(`  Fuzzy MEDIUM confidence:   ${fuzzyMed}`);
  console.log(`  No match found:            ${noMatch}`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Total to update:           ${updates.length}`);
  console.log('');

  if (noMatchRows.length) {
    console.log('Rows with NO match (score too low):');
    noMatchRows.forEach(r => console.log(`  [${r.score}] "${r.name}" | "${r.address}"`));
    console.log('');
  }

  // ── Run updates ──────────────────────────────────────────────────────────
  console.log(`📤 Updating in chunks of ${CHUNK_SIZE}...`);
  let totalErrors = 0;

  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const errs = await updateChunk(chunk);
    totalErrors += errs;
    const end = Math.min(i + CHUNK_SIZE, updates.length);
    console.log(`  Rows ${i}–${end} ✓${errs ? ` (${errs} errors)` : ''}`);
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`✅ Complete.`);
  console.log(`   Successfully updated: ${updates.length - totalErrors}`);
  console.log(`   Errors:               ${totalErrors}`);
  console.log(`   No match found:       ${noMatch}`);
  console.log('══════════════════════════════════════════════');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
