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
    .update({ crm_stage: toStage })
    .eq('id', businessId)

  if (bizError) throw bizError

  const { error: actError } = await supabase
    .from('activities')
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
  const { error } = await supabase
    .from('activities')
    .insert({
      business_id: businessId,
      type: 'note',
      body,
      created_by: userId
    })

  if (error) throw error
}
