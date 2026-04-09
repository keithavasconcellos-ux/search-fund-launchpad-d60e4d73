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
      classification:business_classifications(
        vertical, category, business_type, gbp_confidence, sf_score
      )
    `)
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
      dd_memos(*)
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
export async function getMapPinsInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  filters?: {
    review_status?: ReviewStatus
    crm_stage?: CrmStage
    state_abbr?: string
    vertical?: string
    business_type?: string
  },
  limit = 500
) {
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
      classification:business_classifications(
        vertical, category, business_type, gbp_confidence
      )
    `)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('lat', bounds.south)
    .lte('lat', bounds.north)
    .gte('lng', bounds.west)
    .lte('lng', bounds.east)
    .limit(limit)

  if (filters?.review_status) query = query.eq('review_status', filters.review_status)
  if (filters?.crm_stage)     query = query.eq('crm_stage', filters.crm_stage)
  if (filters?.state_abbr)    query = query.eq('state_abbr', filters.state_abbr)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
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
      classification:business_classifications(
        vertical, category, business_type, gbp_confidence
      )
    `)
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
