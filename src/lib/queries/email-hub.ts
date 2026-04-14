import { supabase } from '@/integrations/supabase/client'

// ──────────────────────────────────────────────
// Inbox queries
// ──────────────────────────────────────────────

export async function getInboxThreads() {
  const { data, error } = await supabase
    .from('email_threads')
    .select(`
      *,
      contact:contacts(name, email, phone),
      business:businesses(id, name, crm_stage, review_status)
    `)
    .not('reply_body', 'is', null)
    .order('replied_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getThreadById(threadId: string) {
  const { data, error } = await supabase
    .from('email_threads')
    .select(`
      *,
      contact:contacts(name, email, phone),
      business:businesses(id, name, crm_stage, review_status)
    `)
    .eq('id', threadId)
    .single()

  if (error) throw error
  return data
}

// ──────────────────────────────────────────────
// Compose queue
// ──────────────────────────────────────────────

export async function getComposeQueue() {
  const { data, error } = await supabase
    .from('email_threads')
    .select(`
      *,
      contact:contacts(name, email),
      business:businesses(id, name, address, crm_stage)
    `)
    .eq('status', 'draft')
    .is('scheduled_at' as any, null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

// ──────────────────────────────────────────────
// Analytics
// ──────────────────────────────────────────────

export interface EmailAnalytics {
  sent: number
  opened: number
  replied: number
  positiveReplies: number
  crmEntered: number
  byIndustry: Array<{ name: string; sent: number; replied: number; rate: number }>
  byLetter: Array<{ name: string; sent: number; replied: number; rate: number }>
}

export async function getEmailAnalytics(filters?: {
  days?: number
  vertical?: string
  letterNumber?: number
}): Promise<EmailAnalytics> {
  const days = filters?.days ?? 30
  const since = new Date()
  since.setDate(since.getDate() - days)

  let query = supabase
    .from('email_threads')
    .select(`
      id, status, sent_at, opened_at, replied_at, reply_body,
      response_classification, letter_number,
      business:businesses!inner(id, crm_stage, in_crm),
      classification:businesses!inner(
        business_classifications(vertical)
      )
    `)
    .gte('sent_at', since.toISOString())
    .not('status', 'eq', 'draft')

  if (filters?.letterNumber) {
    query = query.eq('letter_number', filters.letterNumber)
  }

  const { data, error } = await query
  if (error) throw error

  const threads = data ?? []
  const sent = threads.length
  const opened = threads.filter((t: any) => t.opened_at).length
  const replied = threads.filter((t: any) => t.reply_body).length
  const positiveReplies = threads.filter((t: any) => t.response_classification === 'positive').length
  const crmEntered = threads.filter((t: any) => t.business?.in_crm).length

  // Group by vertical
  const verticalMap: Record<string, { sent: number; replied: number }> = {}
  for (const t of threads as any[]) {
    const v = t.classification?.business_classifications?.[0]?.vertical ?? 'Unknown'
    if (!verticalMap[v]) verticalMap[v] = { sent: 0, replied: 0 }
    verticalMap[v].sent++
    if (t.reply_body) verticalMap[v].replied++
  }
  const byIndustry = Object.entries(verticalMap)
    .map(([name, d]) => ({ name, ...d, rate: d.sent > 0 ? Math.round((d.replied / d.sent) * 1000) / 10 : 0 }))
    .sort((a, b) => b.rate - a.rate)

  // Group by letter
  const letterMap: Record<string, { sent: number; replied: number }> = {}
  for (const t of threads as any[]) {
    const l = t.letter_number ? `Letter ${t.letter_number}` : 'Unknown'
    if (!letterMap[l]) letterMap[l] = { sent: 0, replied: 0 }
    letterMap[l].sent++
    if (t.reply_body) letterMap[l].replied++
  }
  const byLetter = Object.entries(letterMap)
    .map(([name, d]) => ({ name, ...d, rate: d.sent > 0 ? Math.round((d.replied / d.sent) * 1000) / 10 : 0 }))
    .sort((a, b) => {
      const aNum = parseInt(a.name.replace(/\D/g, '')) || 99
      const bNum = parseInt(b.name.replace(/\D/g, '')) || 99
      return aNum - bNum
    })

  return { sent, opened, replied, positiveReplies, crmEntered, byIndustry, byLetter }
}

// ──────────────────────────────────────────────
// Templates
// ──────────────────────────────────────────────

export async function getEmailTemplates() {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('target_vertical', { ascending: true })
    .order('letter_number', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function upsertEmailTemplate(template: {
  id?: string
  name: string
  subject_template: string
  body_template: string
  target_vertical: string | null
  letter_number: number
  is_active: boolean
}) {
  const { data, error } = await supabase
    .from('email_templates')
    .upsert(template as any)
    .select()
    .single()

  if (error) throw error
  return data
}

// ──────────────────────────────────────────────
// Sequences
// ──────────────────────────────────────────────

export async function getEmailSequences() {
  const { data, error } = await (supabase.from('email_sequences') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function upsertEmailSequence(sequence: {
  id?: string
  name: string
  target_vertical: string | null
  is_active: boolean
  steps: Array<{ template_id: string | null; delay_days: number; step_order: number }>
}) {
  const { data, error } = await (supabase.from('email_sequences') as any)
    .upsert(sequence)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteEmailSequence(id: string) {
  const { error } = await (supabase.from('email_sequences') as any)
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ──────────────────────────────────────────────
// Verticals for filter dropdowns
// ──────────────────────────────────────────────

export async function getDistinctVerticals(): Promise<string[]> {
  const { data, error } = await supabase
    .from('business_classifications')
    .select('vertical')
    .not('vertical', 'is', null)

  if (error) throw error
  const set = new Set((data ?? []).map((d: any) => d.vertical).filter(Boolean))
  return Array.from(set).sort() as string[]
}
