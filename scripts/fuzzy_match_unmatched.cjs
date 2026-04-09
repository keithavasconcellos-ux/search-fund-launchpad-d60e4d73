/**
 * fuzzy_match_unmatched.cjs
 *
 * Investigates the 2,522 unmatched CSV rows by:
 *  1. Diagnosing WHY they didn't exact-match (encoding corruption, address format, etc.)
 *  2. Running fuzzy name matching (Jaro-Winkler) against all DB businesses
 *  3. Outputting a CSV for human review before any changes are made
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dzepmywtihvjgewdrynx.supabase.co';
const key = fs.readFileSync('Credentials/supabase_servicerole_key', 'utf8')
  .replace('service_role_key=', '').trim();
const supabase = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

// ── String utilities ──────────────────────────────────────────────────────────

function normalize(s) {
  return (s ?? '')
    .trim()
    .toLowerCase()
    // Fix common UTF-8 double-encoding artifacts (Ã© → é, etc.)
    .replace(/ÃÂ[a-z¡-þ]|Ã[¡-þ]/gi, '')
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fix encoding artifacts in raw string (for display in CSV)
function fixEncoding(s) {
  if (!s) return '';
  // Replace double-encoded UTF-8 sequences: Ã© → é pattern
  return s
    .replace(/Ã©/g, 'é').replace(/Ã¨/g, 'è').replace(/Ãª/g, 'ê')
    .replace(/Ã /g, 'à').replace(/Ã¢/g, 'â').replace(/Ã®/g, 'î')
    .replace(/Ã´/g, 'ô').replace(/Ã»/g, 'û').replace(/Ã¹/g, 'ù')
    .replace(/Ã§/g, 'ç').replace(/Ã‰/g, 'É').replace(/Ã€/g, 'À')
    .replace(/Ã‡/g, 'Ç').replace(/Ã‹/g, 'Ë').replace(/Ã\x8e/g, 'Î')
    .replace(/Ã\x94/g, 'Ô').replace(/ÃÂ/g, '') // cleanup residual
    .trim();
}

// Jaro-Winkler similarity (0–1)
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0, transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true; s2Matches[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ── Load data ─────────────────────────────────────────────────────────────────

async function loadAllBusinesses() {
  console.log('📥 Loading all businesses from Supabase...');
  let page = 0, all = [];
  while (true) {
    const { data, error } = await supabase
      .from('businesses').select('id,name,address')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data); page++;
    if (data.length < 1000) break;
  }
  console.log(`✅ Loaded ${all.length} businesses.\n`);
  return all;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const businesses = await loadAllBusinesses();

  // Build exact-match lookup (normalized)
  const exactMap = new Map();
  for (const b of businesses) {
    const key = normalize(b.name) + '|' + normalize(b.address);
    exactMap.set(key, b.id);
  }

  // Pre-compute normalized names for fuzzy index
  const dbNorm = businesses.map(b => ({
    ...b,
    normName: normalize(b.name),
    normAddr: normalize(b.address),
  }));

  // Build first-token index for fast candidate pruning
  const tokenIndex = new Map();
  for (const b of dbNorm) {
    const token = b.normName.split(' ')[0];
    if (!tokenIndex.has(token)) tokenIndex.set(token, []);
    tokenIndex.get(token).push(b);
  }

  console.log('📂 Reading CSV...');
  const raw = fs.readFileSync('CSVs/ne_places_gbp_ScrapedClass.csv', 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, bom: true });

  // Separate exact-matched vs unmatched
  const unmatched = records.filter(row => {
    const key = normalize(row['Business Name']) + '|' + normalize(row['Address']);
    return !exactMap.has(key);
  });

  console.log(`Found ${unmatched.length} unmatched rows. Running fuzzy match...\n`);

  const results = [];

  for (let i = 0; i < unmatched.length; i++) {
    const row = unmatched[i];
    const csvName = fixEncoding(row['Business Name']);
    const csvAddr = fixEncoding(row['Address']);
    const normCsvName = normalize(row['Business Name']);
    const normCsvAddr = normalize(row['Address']);

    // ─── Candidate selection: first try token index, fall back to all ─────
    const token = normCsvName.split(' ')[0];
    let candidates = tokenIndex.get(token) ?? [];
    if (candidates.length < 5) candidates = dbNorm; // fallback: search all

    // ─── Score candidates ─────────────────────────────────────────────────
    let bestScore = 0, bestMatch = null, bestReason = '';
    for (const b of candidates) {
      const nameSim = jaroWinkler(normCsvName, b.normName);
      if (nameSim < 0.75) continue; // fast rejection

      const addrSim = b.normAddr && normCsvAddr
        ? jaroWinkler(normCsvAddr, b.normAddr)
        : 0.5; // no address = neutral

      const combined = nameSim * 0.65 + addrSim * 0.35;
      if (combined > bestScore) {
        bestScore = combined;
        bestMatch = b;
        bestReason = nameSim >= 0.98
          ? 'name_near_exact'
          : nameSim >= 0.90
          ? 'name_high'
          : 'name_medium';
      }
    }

    // ─── Confidence label ─────────────────────────────────────────────────
    let confidence;
    if (bestScore >= 0.95)      confidence = 'VERY_HIGH';
    else if (bestScore >= 0.88) confidence = 'HIGH';
    else if (bestScore >= 0.80) confidence = 'MEDIUM';
    else if (bestScore >= 0.70) confidence = 'LOW';
    else { confidence = 'NO_MATCH'; bestMatch = null; }

    // ─── Diagnose why exact match failed ─────────────────────────────────
    let mismatchReason = '';
    if (bestMatch) {
      const origCsvName = (row['Business Name'] ?? '').trim();
      const origDbName  = (bestMatch.name ?? '').trim();
      if (origCsvName !== origDbName) {
        // Check for encoding issue
        if (fixEncoding(origCsvName) === origDbName ||
            origCsvName.includes('Ã') || origCsvName.includes('â€')) {
          mismatchReason = 'encoding_corruption';
        } else {
          mismatchReason = 'name_text_diff';
        }
      } else if ((row['Address']??'').trim() !== (bestMatch.address??'').trim()) {
        mismatchReason = fixEncoding(row['Address'] ?? '').trim() === (bestMatch.address??'').trim()
          ? 'address_encoding_corruption'
          : 'address_text_diff';
      }
    } else {
      mismatchReason = 'no_match_found';
    }

    results.push({
      // What we're trying to match
      csv_name:     csvName,
      csv_address:  csvAddr,
      csv_vertical: row['Vertical'] ?? '',
      csv_category: row['Category'] ?? '',
      csv_business_type: row['Business Type'] ?? '',

      // Best DB match found
      db_id:          bestMatch?.id ?? '',
      db_name:        bestMatch?.name ?? '',
      db_address:     bestMatch?.address ?? '',

      // Match quality
      confidence,
      score:          bestScore ? bestScore.toFixed(4) : '',
      match_reason:   bestReason,
      mismatch_cause: mismatchReason,
    });

    if ((i + 1) % 200 === 0) process.stdout.write(`  Processed ${i + 1}/${unmatched.length}...\n`);
  }

  // ─── Summary stats ────────────────────────────────────────────────────────
  const summary = {};
  for (const r of results) {
    summary[r.confidence] = (summary[r.confidence] ?? 0) + 1;
  }
  const causeSummary = {};
  for (const r of results) {
    causeSummary[r.mismatch_cause] = (causeSummary[r.mismatch_cause] ?? 0) + 1;
  }

  console.log('\n══════════════════════════════════════════');
  console.log('FUZZY MATCH RESULTS');
  console.log('══════════════════════════════════════════');
  console.log('Confidence distribution:');
  ['VERY_HIGH','HIGH','MEDIUM','LOW','NO_MATCH'].forEach(k => {
    if (summary[k]) console.log(`  ${k.padEnd(10)}: ${summary[k]}`);
  });
  console.log('\nMismatch root causes:');
  Object.entries(causeSummary).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    console.log(`  ${k.padEnd(30)}: ${v}`);
  });

  // ─── Write CSV ──────────────────────────────────────────────────────────
  const outPath = 'scripts/fuzzy_match_review.csv';
  const csvOut = stringify(results, { header: true });
  fs.writeFileSync(outPath, csvOut);
  console.log(`\n✅ Review CSV written to: ${outPath}`);
  console.log('   Review this file before running any updates.\n');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
