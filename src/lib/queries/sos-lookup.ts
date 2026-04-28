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
  state: string;
  fetched_at: string;
}

interface BizParams {
  id: string;
  name: string;
  state_abbr: string | null;
  city?: string | null;
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

// Normalize a business name for comparison — strip punctuation, lower, trim.
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchCtData(biz: BizParams): Promise<SosData | null> {
  // Step 1: search Business Master by name (full-text search via $q)
  const nameEncoded = encodeURIComponent(`"${biz.name}"`);
  const masterUrl =
    `${CT_BASE}/${CT_MASTER_ID}.json?$q=${nameEncoded}&$limit=10`;

  const masterRes = await fetch(masterUrl);
  if (!masterRes.ok) throw new Error(`CT Socrata error: ${masterRes.status}`);
  const masterRows: any[] = await masterRes.json();

  if (masterRows.length === 0) return null;

  // Pick best match by normalized name similarity
  const target = normalizeName(biz.name);
  const best = masterRows
    .map(r => ({ ...r, _score: normalizeName(r.business_name ?? '').includes(target) ? 1 : 0 }))
    .sort((a, b) => b._score - a._score)[0];

  const accountId: string | undefined = best.account_id ?? best.id;
  if (!accountId) return null;

  // Step 2: fetch principals (officers/directors/members) for this account
  let officers: { name: string; title: string }[] = [];
  try {
    const princUrl =
      `${CT_BASE}/${CT_PRINCIPALS_ID}.json?account_id=${encodeURIComponent(accountId)}&$limit=25`;
    const princRes = await fetch(princUrl);
    if (princRes.ok) {
      const princRows: any[] = await princRes.json();
      officers = princRows.map(p => ({
        name: [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || p.principal_name || '',
        title: p.title ?? p.principal_type ?? '',
      })).filter(o => o.name);
    }
  } catch { /* non-fatal */ }

  // Step 3: fetch registered agent
  let registeredAgent: string | null = null;
  try {
    const agentUrl =
      `${CT_BASE}/${CT_AGENTS_ID}.json?account_id=${encodeURIComponent(accountId)}&$limit=5`;
    const agentRes = await fetch(agentUrl);
    if (agentRes.ok) {
      const agentRows: any[] = await agentRes.json();
      const agent = agentRows[0];
      if (agent) {
        registeredAgent = [
          agent.agent_name ?? [agent.first_name, agent.last_name].filter(Boolean).join(' '),
          agent.agent_street_address,
          agent.agent_city,
        ].filter(Boolean).join(', ') || null;
      }
    }
  } catch { /* non-fatal */ }

  // Step 4: assemble DBA names from Name Change History if business_name differs
  const dbaNames: string[] = [];
  if (best.dba_name) dbaNames.push(best.dba_name);

  // Build principal address
  const principalAddress = [
    best.business_address,
    best.business_city,
    best.business_state,
    best.business_zip_code,
  ].filter(Boolean).join(', ') || null;

  return {
    entity_type: best.business_type ?? best.entity_type ?? null,
    formation_date: best.date_registration ?? best.formation_date ?? null,
    status: best.status ?? null,
    registered_agent: registeredAgent,
    officers,
    principal_address: principalAddress,
    dba_names: dbaNames,
    naics_code: best.naics_code ?? null,
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
