import { supabase } from '@/integrations/supabase/client'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  contactId: string
  businessId: string
  scheduledAt: string    // UTC ISO string
  durationMins: number
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null
  provider: string
  externalEventId: string | null
  createdAt: string
}

export interface CreateEventInput {
  contactId: string
  businessId: string
  scheduledAt: string
  durationMins?: number
  notes?: string
}

// ──────────────────────────────────────────────
// Interface
// ──────────────────────────────────────────────

export interface ICalendarService {
  createEvent(input: CreateEventInput): Promise<CalendarEvent>
  updateEvent(id: string, updates: Partial<Pick<CalendarEvent, 'scheduledAt' | 'durationMins' | 'status' | 'notes'>>): Promise<void>
  deleteEvent(id: string): Promise<void>
  getEventsForWeek(weekStart: Date): Promise<CalendarEvent[]>
  getUpcomingEvents(limit?: number): Promise<CalendarEvent[]>
}

// ──────────────────────────────────────────────
// Row mapper
// ──────────────────────────────────────────────

function mapRow(row: any): CalendarEvent {
  return {
    id: row.id,
    contactId: row.contact_id,
    businessId: row.business_id,
    scheduledAt: row.scheduled_at,
    durationMins: row.duration_mins,
    status: row.status,
    notes: row.notes,
    provider: row.provider,
    externalEventId: row.external_event_id,
    createdAt: row.created_at,
  }
}

// ──────────────────────────────────────────────
// MockCalendarService — Supabase only
// ──────────────────────────────────────────────

class MockCalendarService implements ICalendarService {
  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const { data, error } = await (supabase.from('scheduled_calls') as any)
      .insert({
        contact_id: input.contactId,
        business_id: input.businessId,
        scheduled_at: input.scheduledAt,
        duration_mins: input.durationMins ?? 30,
        notes: input.notes ?? null,
        provider: 'manual',
        status: 'scheduled',
      })
      .select()
      .single()

    if (error) throw error

    // Log activity
    await (supabase.from('activities') as any).insert({
      business_id: input.businessId,
      contact_id: input.contactId,
      type: 'call_scheduled',
      body: `Call scheduled at ${new Date(input.scheduledAt).toLocaleString()}`,
    })

    return mapRow(data)
  }

  async updateEvent(id: string, updates: Partial<Pick<CalendarEvent, 'scheduledAt' | 'durationMins' | 'status' | 'notes'>>): Promise<void> {
    const row: Record<string, unknown> = {}
    if (updates.scheduledAt !== undefined) row.scheduled_at = updates.scheduledAt
    if (updates.durationMins !== undefined) row.duration_mins = updates.durationMins
    if (updates.status !== undefined) row.status = updates.status
    if (updates.notes !== undefined) row.notes = updates.notes

    const { error } = await (supabase.from('scheduled_calls') as any)
      .update(row)
      .eq('id', id)

    if (error) throw error
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await (supabase.from('scheduled_calls') as any)
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async getEventsForWeek(weekStart: Date): Promise<CalendarEvent[]> {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data, error } = await (supabase.from('scheduled_calls') as any)
      .select('*')
      .gte('scheduled_at', weekStart.toISOString())
      .lt('scheduled_at', weekEnd.toISOString())
      .order('scheduled_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(mapRow)
  }

  async getUpcomingEvents(limit = 3): Promise<CalendarEvent[]> {
    const { data, error } = await (supabase.from('scheduled_calls') as any)
      .select('*')
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return (data ?? []).map(mapRow)
  }
}

// ──────────────────────────────────────────────
// Factory
// ──────────────────────────────────────────────

export const calendarService = new MockCalendarService() as ICalendarService
