import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SosData {
  entity_type: string | null;
  formation_date: string | null;
  status: string | null;         // e.g. "Active", "Dissolved"
  registered_agent: string | null;
  officers: { name: string; title: string }[];
  principal_address: string | null;
  dba_names: string[];
  naics_code: string | null;
  source_url: string | null;
  matched_name: string | null;   // registry name that was matched — shown in UI for verification
  state: string;
  fetched_at: string;
}

interface BizParams {
  id: string;
  name: string;
  state_abbr: string | null;
  city?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Normalize a string for comparison — strip punctuation, lower, collapse spaces.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse the city out of a typical Google address string:
 * "123 Main St, Stamford, CT 06902"  →  "Stamford"
 * "456 Oak Ave, Greenwich, CT 06831" →  "Greenwich"
 * Falls back to null if the pattern can't be detected.
 */
function parseCityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  // Google addresses can have trailing country: "123 Main St, Glastonbury, CT 06033, USA"
  // Strip any trailing segment that is a country name or 2-letter code
  let parts = address.split(',').map(p => p.trim()).filter(Boolean);
  // Drop trailing 'USA' / 'US' / country segment
  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    if (/^(USA?|United States|Canada)$/i.test(last)) {
      parts = parts.slice(0, -1);
    }
  }
  // Need at least: [street, city, state+zip]
  if (parts.length < 3) return null;
  // Second-to-last is the city; last is normally "CT 06033" or "CT"
  const cityCandidate = parts[parts.length - 2];
  // Sanity-check: shouldn't be a zip code or bare 2-letter state
  if (/^\d{5}/.test(cityCandidate) || /^[A-Z]{2}$/.test(cityCandidate)) return null;
  // Also reject "CT 06033" style (state + zip in same segment)
  if (/^[A-Z]{2}\s+\d{5}/.test(cityCandidate)) return null;
  return cityCandidate;
}

// ─── CT — Socrata API ─────────────────────────────────────────────────────────
// CT publishes the full Business Registry on data.ct.gov as a free, nightly-
// updated Socrata dataset. No auth required (app token reduces throttling).
//
// Datasets used:
//   Business Master  : https://data.ct.gov/resource/n7gp-d28j.json
//   Principals (officers): https://data.ct.gov/resource/ka36-64k6.json
//   Agents           : https://data.ct.gov/resource/qh2m-n44y.json

const CT_BASE = 'https://data.ct.gov/resource';
const CT_MASTER_ID = 'n7gp-d28j';
const CT_PRINCIPALS_ID = 'ka36-64k6';
const CT_AGENTS_ID = 'qh2m-n44y';

async function fetchCtData(biz: BizParams): Promise<SosData | null> {
  const city = biz.city ? biz.city : null;

  // Step 1: Cast a wide net with a loose $q search.
  // Use the first 1-2 significant words of the name (skip articles/suffixes like LLC, The).
  // This maximises recall — the scoring step below filters down to the best match.
  const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'llc', 'inc', 'corp', 'ltd', 'co']);
  const nameTokens = normalize(biz.name)
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  // Use up to the first 2 meaningful tokens for the $q search
  const searchTerm = nameTokens.slice(0, 2).join(' ') || biz.name;

  let masterUrl = `${CT_BASE}/${CT_MASTER_ID}.json?$q=${encodeURIComponent(searchTerm)}&$limit=30`;
  if (city) {
    // billingcity is the correct Socrata column name for CT Business Registry
    masterUrl += `&$where=${encodeURIComponent(`upper(billingcity)='${city.toUpperCase()}'`)}`;
  }

  const masterRes = await fetch(masterUrl);
  if (!masterRes.ok) throw new Error(`CT Socrata error: ${masterRes.status}`);
  let masterRows: any[] = await masterRes.json();

  // If city-filtered search returned nothing, retry without city filter
  if (masterRows.length === 0 && city) {
    const fallbackUrl = `${CT_BASE}/${CT_MASTER_ID}.json?$q=${encodeURIComponent(searchTerm)}&$limit=30`;
    const fallbackRes = await fetch(fallbackUrl);
    if (fallbackRes.ok) masterRows = await fallbackRes.json();
  }

  if (masterRows.length === 0) return null;

  // Step 2: score every candidate.
  // CT Socrata column names: 'name' = business name, 'billingcity' = city
  const targetName = normalize(biz.name);
  const targetCity = city ? normalize(city) : null;

  const scored = masterRows.map(r => {
    const rowName = normalize(r.name ?? '');
    const rowCity = normalize(r.billingcity ?? '');

    // Name score — intentionally loose to match variations like "Paw Spa LLC" vs "Paw Spa"
    let nameScore = 0;
    if (rowName === targetName) nameScore = 3;
    else if (rowName.includes(targetName)) nameScore = 2;
    else if (targetName.includes(rowName) && rowName.length > 3) nameScore = 2;
    else {
      // Token overlap: how many name words appear in the registry name?
      const targetTokens = targetName.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));
      const overlapCount = targetTokens.filter(w => rowName.includes(w)).length;
      if (overlapCount > 0) nameScore = overlapCount; // 1 per overlapping word
    }

    // City score — binary: 3 if city matches exactly, 0 otherwise
    const cityScore = (targetCity && rowCity === targetCity) ? 3 : 0;

    return { ...r, _nameScore: nameScore, _cityScore: cityScore, _score: nameScore + cityScore };
  });

  // Acceptance rule:
  // - City known → accept any candidate with cityScore > 0 (city is our anchor)
  // - No city    → require nameScore > 0 (at least a loose name match)
  const minScore = targetCity ? 3 : 1; // city match alone (3) passes; no-city needs nameScore>0
  const candidates = scored
    .filter(r => r._score >= minScore)
    .sort((a, b) => b._score - a._score);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  // CT master 'id' is the Salesforce record ID used to join principals and agents
  const accountId: string | undefined = best.id;
  if (!accountId) return null;

  // Step 3: fetch principals (officers/directors/members) — joined by business_id
  // Confirmed CT Socrata fields: business_id, name__c, firstname, lastname, designation
  let officers: { name: string; title: string }[] = [];
  try {
    const princUrl =
      `${CT_BASE}/${CT_PRINCIPALS_ID}.json?$where=${encodeURIComponent(`business_id='${accountId}'`)}&$limit=25`;
    const princRes = await fetch(princUrl);
    if (princRes.ok) {
      const princRows: any[] = await princRes.json();
      officers = princRows.map(p => ({
        name: p.name__c ?? [p.firstname, p.lastname].filter(Boolean).join(' ') ?? '',
        title: p.designation ?? p.title ?? '',
      })).filter(o => o.name);
    }
  } catch { /* non-fatal */ }

  // Step 4: fetch registered agent — joined by business_id (uses 'business_key' as record ID)
  // Confirmed CT Socrata fields: name__c, business_street_address_1, business_city
  let registeredAgent: string | null = null;
  try {
    const agentUrl =
      `${CT_BASE}/${CT_AGENTS_ID}.json?$where=${encodeURIComponent(`business_id='${accountId}'`)}&$limit=5`;
    const agentRes = await fetch(agentUrl);
    if (agentRes.ok) {
      const agentRows: any[] = await agentRes.json();
      const agent = agentRows[0];
      if (agent) {
        registeredAgent = [
          agent.name__c,
          agent.business_street_address_1,
          agent.business_city,
          agent.business_state,
        ].filter(Boolean).join(', ') || null;
      }
    }
  } catch { /* non-fatal */ }

  // Step 5: DBA names
  const dbaNames: string[] = [];
  if (best.dba_name) dbaNames.push(best.dba_name);

  // Build principal address from correct Socrata fields
  const principalAddress = [
    best.billingstreet,
    best.billingcity,
    best.billingstate,
    best.billingpostalcode,
  ].filter(Boolean).join(', ') || null;

  return {
    entity_type: best.business_type ?? null,
    formation_date: best.date_registration ?? null,
    status: best.status ?? null,
    registered_agent: registeredAgent,
    officers,
    principal_address: principalAddress,
    dba_names: best.dba ? [best.dba] : [],
    naics_code: best.naics_code ?? null,
    matched_name: best.name ?? null,
    source_url: `https://service.ct.gov/business/s/onlinebusinesssearch?language=en_US`,
    state: 'CT',
    fetched_at: new Date().toISOString(),
  };
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

export async function fetchSosData(biz: BizParams): Promise<SosData | null> {
  const state = (biz.state_abbr ?? '').toUpperCase();

  let result: SosData | null = null;

  switch (state) {
    case 'CT':
      result = await fetchCtData(biz);
      break;
    // MA, RI → Phase 2 (Edge Function)
    // NH, VT → Phase 3 (deep links only, no data returned)
    default:
      return null;
  }

  if (result) {
    // Persist to Supabase so subsequent panel opens load instantly
    await supabase
      .from('businesses')
      .update({
        sos_data: result as any,
        sos_fetched_at: result.fetched_at,
        sos_state: result.state,
      } as any)
      .eq('id', biz.id);
  }

  return result;
}

// Export city parser so SosTab can use it without duplicating logic
export { parseCityFromAddress };
