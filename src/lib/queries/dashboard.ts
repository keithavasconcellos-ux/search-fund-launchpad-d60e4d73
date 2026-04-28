import { supabase } from '../supabase'

// Pipeline funnel counts — businesses in the CRM (matches /crm page)
export async function getPipelineFunnelCounts() {
  const { data, error } = await supabase
    .from('businesses')
    .select('crm_stage')
    .eq('in_crm', true)

  if (error) throw error

  const counts: Record<string, number> = {}
  data.forEach(row => {
    counts[row.crm_stage] = (counts[row.crm_stage] ?? 0) + 1
  })
  return counts
}

// Dashboard KPIs
export async function getDashboardKpis(periodDays: number = 7) {
  const since = new Date()
  since.setDate(since.getDate() - periodDays)
  const sinceISO = since.toISOString()

  const [businessCount, emailStats, recentActivity] = await Promise.all([
    supabase.from('businesses').select('id, classification:business_classifications!inner(vertical)', { count: 'exact', head: true }).neq('business_classifications.vertical', 'Out of Scope'),
    supabase.from('email_threads')
      .select('status, response_classification')
      .gte('sent_at', sinceISO),
    supabase.from('activities')
      .select('*, businesses(name, crm_stage)')
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  const totalEmails = emailStats.data?.length ?? 0
  const replies = emailStats.data?.filter(e => e.status === 'replied').length ?? 0
  const positiveReplies = emailStats.data?.filter(e => e.response_classification === 'positive').length ?? 0

  return {
    total_businesses: businessCount.count ?? 0,
    emails_sent: totalEmails,
    reply_rate: totalEmails > 0 ? (replies / totalEmails) : 0,
    positive_rate: totalEmails > 0 ? (positiveReplies / totalEmails) : 0,
    recent_activity: recentActivity.data ?? []
  }
}

// Needs attention — businesses in late stages with no recent activity
export async function getNeedsAttention() {
  const { data, error } = await supabase
    .from('businesses')
    .select(`
      id, name, crm_stage, last_activity_at,
      classification:business_classifications!inner(vertical, business_type)
    `)
    .neq('business_classifications.vertical', 'Out of Scope')
    .in('crm_stage', ['engaged', 'nda_signed', 'active_loi'])
    .order('last_activity_at', { ascending: true })
    .limit(10)

  if (error) throw error
  return data
}
