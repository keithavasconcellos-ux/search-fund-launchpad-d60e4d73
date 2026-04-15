import { supabase } from '../supabase'
import type { CrmStage, ReviewStatus } from '../../types/acquira'

// Fetch businesses with their classification joined
// Used by: Library table, Map View, Dashboard
export async function getBusinesses(filters?: {
  crm_stage?: CrmStage
  vertical?: string
  sf_score_min?: number
  review_status?: ReviewStatus
  search?: string
  limit?: number
  offset?: number
}) {
  let query = supabase
    .from('businesses')
    .select(`
      *,
      classification:business_classifications!inner(
        vertical, category, business_type, gbp_confidence, sf_score
      )
    `)
    .neq('business_classifications.vertical', 'Out of Scope')
    .order('last_activity_at', { ascending: false, nullsFirst: false })

  if (filters?.crm_stage)      query = query.eq('crm_stage', filters.crm_stage)
  if (filters?.review_status)  query = query.eq('review_status', filters.review_status)
  if (filters?.search)         query = query.ilike('name', `%${filters.search}%`)
  if (filters?.limit)          query = query.limit(filters.limit)
  if (filters?.offset != null && filters?.limit)
    query = query.range(filters.offset, filters.offset + (filters.limit ?? 50) - 1)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Fetch a single business with all related data
export async function getBusinessById(id: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      *,
      classification:business_classifications(*),
      contacts(*),
      activities(*),
      email_threads(*),
      dd_documents(*),
      dd_memos(*),
      sba_loans!sba_loans_matched_business_id_fkey(*)
    `)
    .eq('id', id)
    .order('created_at', { referencedTable: 'activities', ascending: false })
    .order('sent_at', { referencedTable: 'email_threads', ascending: false })
    .order('version', { referencedTable: 'dd_memos', ascending: false })
    .limit(20, { referencedTable: 'activities' })
    .limit(1, { referencedTable: 'dd_memos' })
    .single()

  if (error) throw error
  return data
}

// Update CRM stage and log to activities
export async function updateCrmStage(
  businessId: string,
  fromStage: CrmStage,
  toStage: CrmStage,
  userId: string
) {
  const { error: bizError } = await supabase
    .from('businesses')
    .update({ crm_stage: toStage } as any)
    .eq('id', businessId)

  if (bizError) throw bizError

  const { error: actError } = await (supabase
    .from('activities') as any)
    .insert({
      business_id: businessId,
      type: 'stage_change',
      from_stage: fromStage,
      to_stage: toStage,
      body: `Stage moved from ${fromStage} to ${toStage}`,
      created_by: userId
    })

  if (actError) throw actError
}

// Add a note
export async function addNote(
  businessId: string,
  body: string,
  userId: string
) {
  const { error } = await (supabase
    .from('activities') as any)
    .insert({
      business_id: businessId,
      type: 'note',
      body,
      created_by: userId
    })

  if (error) throw error
}

// Viewport-based fetch — only loads pins inside the current map bounds.
// Called on every map idle event (after pan/zoom stops) like Airbnb.
// When classification filters are active, uses !inner join to restrict.
export type TaxonomyTree = Record<string, Record<string, string[]>>

export interface MapPin {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  state_abbr: string | null
  county: string | null
  crm_stage: string
  review_status: string
  website: string | null
  in_crm: boolean
  classification: Array<{
    vertical: string | null
    category: string | null
    business_type: string | null
    gbp_confidence: string | null
    primary_gbp_category: string | null
  }> | null
}

export async function getMapPinsInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  filters?: {
    review_status?: ReviewStatus
    crm_stage?: CrmStage
    state_abbr?: string
    county?: string
    vertical?: string
    category?: string
    business_type?: string
    primary_gbp_category?: string
    in_crm?: boolean
  },
  limit = 500
): Promise<MapPin[]> {
  const hasClsFilter = !!(filters?.vertical || filters?.category || filters?.business_type || filters?.primary_gbp_category)
  const clsJoin = 'business_classifications!inner'

  let query = supabase
    .from('businesses')
    .select(`
      id,
      name,
      address,
      lat,
      lng,
      state_abbr,
      county,
      crm_stage,
      review_status,
      website,
      in_crm,
      classification:${clsJoin}(
        vertical, category, business_type, gbp_confidence, primary_gbp_category
      )
    `) as any

  query = query
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .neq('business_classifications.vertical', 'Out of Scope')
    .gte('lat', bounds.south)
    .lte('lat', bounds.north)
    .gte('lng', bounds.west)
    .lte('lng', bounds.east)
    .limit(limit)

  if (filters?.review_status) query = query.eq('review_status', filters.review_status)
  if (filters?.crm_stage)     query = query.eq('crm_stage', filters.crm_stage)
  if (filters?.state_abbr)    query = query.eq('state_abbr', filters.state_abbr)
  if (filters?.county)        query = query.eq('county', filters.county)
  if (filters?.in_crm !== undefined) query = query.eq('in_crm', filters.in_crm)

  if (filters?.vertical)              query = query.eq('business_classifications.vertical', filters.vertical)
  if (filters?.category)              query = query.eq('business_classifications.category', filters.category)
  if (filters?.business_type)         query = query.eq('business_classifications.business_type', filters.business_type)
  if (filters?.primary_gbp_category)  query = query.eq('business_classifications.primary_gbp_category', filters.primary_gbp_category)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as MapPin[]
}

// Fetch distinct L1→L2→L3 taxonomy from the DB for the drill-down filter UI.
export async function getClassificationTaxonomy(): Promise<
  Record<string, Record<string, string[]>>
> {
  // Paginate since free tier limits per-request
  let page = 0
  const all: Array<{ vertical: string | null; category: string | null; business_type: string | null }> = []

  while (true) {
    const { data, error } = await supabase
      .from('business_classifications')
      .select('vertical, category, business_type')
      .not('vertical', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1)

    if (error || !data || data.length === 0) break
    all.push(...data)
    page++
    if (data.length < 1000) break
  }

  const result: Record<string, Record<string, Set<string>>> = {}
  for (const r of all) {
    if (!r.vertical || r.vertical === 'Out of Scope') continue
    if (!result[r.vertical]) result[r.vertical] = {}
    if (r.category) {
      if (!result[r.vertical][r.category]) result[r.vertical][r.category] = new Set()
      if (r.business_type) result[r.vertical][r.category].add(r.business_type)
    }
  }

  // Convert Sets → sorted arrays
  const out: Record<string, Record<string, string[]>> = {}
  for (const [v, cats] of Object.entries(result)) {
    out[v] = {}
    for (const [c, types] of Object.entries(cats)) {
      out[v][c] = Array.from(types).sort()
    }
  }
  return out
}

// Legacy full-set fetch — still used by other pages
export async function getMapPins(filters?: {
  vertical?: string
  business_type?: string
  review_status?: ReviewStatus
  state_abbr?: string
  county?: string
  crm_stage?: CrmStage
}) {
  let query = supabase
    .from('businesses')
    .select(`
      id, name, address, lat, lng, state_abbr, state, county,
      crm_stage, review_status, website,
      classification:business_classifications!inner(
        vertical, category, business_type, gbp_confidence
      )
    `)
    .neq('business_classifications.vertical', 'Out of Scope')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(5000)

  if (filters?.review_status) query = query.eq('review_status', filters.review_status)
  if (filters?.crm_stage)     query = query.eq('crm_stage', filters.crm_stage)
  if (filters?.state_abbr)    query = query.eq('state_abbr', filters.state_abbr)
  if (filters?.county)        query = query.eq('county', filters.county)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
