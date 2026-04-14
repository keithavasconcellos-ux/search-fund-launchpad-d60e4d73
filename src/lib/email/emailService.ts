import { supabase } from '@/integrations/supabase/client'
import type { EmailStatus, ResponseClassification } from '@/types/acquira'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface EmailDraft {
  businessId: string
  contactId?: string
  templateId?: string
  letterNumber?: number
  subject: string
  bodyText: string
  bodyHtml?: string
  metadata?: Record<string, unknown>
}

export interface EmailThread {
  id: string
  businessId: string
  contactId: string | null
  templateId: string | null
  subject: string
  bodyText: string | null
  bodyHtml: string | null
  letterNumber: number | null
  status: EmailStatus
  sentAt: string | null
  openedAt: string | null
  repliedAt: string | null
  replyBody: string | null
  responseClassification: ResponseClassification | null
  sendingProvider: string | null
  scheduledAt: string | null
  gmailMessageId: string | null
  gmailThreadId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface SendResult {
  success: boolean
  threadId: string
  error?: string
}

// ──────────────────────────────────────────────
// Interface — all components import this
// ──────────────────────────────────────────────

export interface IEmailService {
  /** Send an email (writes to email_threads + activities) */
  sendEmail(draft: EmailDraft): Promise<SendResult>

  /** Schedule an email for future sending */
  scheduleEmail(draft: EmailDraft, scheduledAt: string): Promise<SendResult>

  /** Get inbox threads that have a reply */
  getInboxThreads(): Promise<EmailThread[]>

  /** Get compose queue — drafts ready for review */
  getComposeQueue(): Promise<EmailThread[]>

  /** Mark a thread as read (viewed) */
  markAsRead(threadId: string): Promise<void>

  /** Get a single thread by ID */
  getThread(threadId: string): Promise<EmailThread | null>

  /** Get all threads for a business */
  getThreadsForBusiness(businessId: string): Promise<EmailThread[]>
}

// ──────────────────────────────────────────────
// Row → EmailThread mapper
// ──────────────────────────────────────────────

function mapRow(row: any): EmailThread {
  return {
    id: row.id,
    businessId: row.business_id,
    contactId: row.contact_id,
    templateId: row.template_id,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    letterNumber: row.letter_number,
    status: row.status as EmailStatus,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    repliedAt: row.replied_at,
    replyBody: row.reply_body,
    responseClassification: row.response_classification as ResponseClassification | null,
    sendingProvider: row.sending_provider ?? null,
    scheduledAt: row.scheduled_at ?? null,
    gmailMessageId: row.gmail_message_id,
    gmailThreadId: row.gmail_thread_id,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ──────────────────────────────────────────────
// MockEmailService — writes to Supabase directly
// ──────────────────────────────────────────────

class MockEmailService implements IEmailService {
  async sendEmail(draft: EmailDraft): Promise<SendResult> {
    const now = new Date().toISOString()

    const { data, error } = await (supabase.from('email_threads') as any).insert({
      business_id: draft.businessId,
      contact_id: draft.contactId ?? null,
      template_id: draft.templateId ?? null,
      letter_number: draft.letterNumber ?? null,
      subject: draft.subject,
      body_text: draft.bodyText,
      body_html: draft.bodyHtml ?? null,
      status: 'sent',
      sent_at: now,
      sending_provider: 'manual',
      metadata: draft.metadata ?? null,
    }).select().single()

    if (error) return { success: false, threadId: '', error: error.message }

    // Log activity
    await (supabase.from('activities') as any).insert({
      business_id: draft.businessId,
      contact_id: draft.contactId ?? null,
      type: 'email_sent',
      body: `Email sent: ${draft.subject}`,
    })

    return { success: true, threadId: data.id }
  }

  async scheduleEmail(draft: EmailDraft, scheduledAt: string): Promise<SendResult> {
    const { data, error } = await (supabase.from('email_threads') as any).insert({
      business_id: draft.businessId,
      contact_id: draft.contactId ?? null,
      template_id: draft.templateId ?? null,
      letter_number: draft.letterNumber ?? null,
      subject: draft.subject,
      body_text: draft.bodyText,
      body_html: draft.bodyHtml ?? null,
      status: 'draft',
      sending_provider: 'manual',
      scheduled_at: scheduledAt,
      metadata: draft.metadata ?? null,
    }).select().single()

    if (error) return { success: false, threadId: '', error: error.message }
    return { success: true, threadId: data.id }
  }

  async getInboxThreads(): Promise<EmailThread[]> {
    const { data, error } = await supabase
      .from('email_threads')
      .select('*')
      .not('reply_body', 'is', null)
      .order('replied_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapRow)
  }

  async getComposeQueue(): Promise<EmailThread[]> {
    const { data, error } = await supabase
      .from('email_threads')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapRow)
  }

  async markAsRead(threadId: string): Promise<void> {
    await (supabase.from('email_threads') as any)
      .update({ opened_at: new Date().toISOString() })
      .eq('id', threadId)
      .is('opened_at', null)
  }

  async getThread(threadId: string): Promise<EmailThread | null> {
    const { data, error } = await supabase
      .from('email_threads')
      .select('*')
      .eq('id', threadId)
      .single()

    if (error) return null
    return mapRow(data)
  }

  async getThreadsForBusiness(businessId: string): Promise<EmailThread[]> {
    const { data, error } = await supabase
      .from('email_threads')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapRow)
  }
}

// ──────────────────────────────────────────────
// Provider factory
// ──────────────────────────────────────────────

type Provider = 'manual' | 'gmail' | 'outlook'

function createEmailService(_provider: Provider = 'manual'): IEmailService {
  // When Gmail/Outlook integrations are added, switch here:
  // case 'gmail': return new GmailEmailService()
  // case 'outlook': return new OutlookEmailService()
  return new MockEmailService()
}

/** Singleton email service — all components import this */
export const emailService = createEmailService('manual')
