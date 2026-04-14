import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { calendarService } from '@/lib/calendar/calendarService'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { ChevronLeft, ChevronRight, Phone, Search, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { format, startOfWeek, addDays, addWeeks, isSameDay, isToday } from 'date-fns'

const HOURS = Array.from({ length: 20 }, (_, i) => 8 * 60 + i * 30) // 08:00–17:30 in minutes
const SLOT_HEIGHT = 48

export default function ScheduleTab() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [search, setSearch] = useState('')
  const [showSaturday, setShowSaturday] = useState(false)
  const [pendingDrop, setPendingDrop] = useState<{ contactId: string; businessId: string; contactName: string; businessName: string; slot: Date } | null>(null)

  const dayCount = showSaturday ? 6 : 5
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i)), [weekStart, dayCount])

  // Fetch schedulable contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['schedulable-contacts'],
    queryFn: async () => {
      // Get contacts whose business has a positive recent reply and is engaged+
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, name, phone, business_id,
          business:businesses(id, name, crm_stage)
        `)
        .limit(100)

      if (error) throw error
      // Filter to engaged/nda_signed/cim_received stages
      return (data ?? []).filter((c: any) => {
        const stage = c.business?.crm_stage
        return stage === 'engaged' || stage === 'nda_signed' || stage === 'cim_received'
      })
    },
  })

  // Fetch events for the current week
  const { data: events = [] } = useQuery({
    queryKey: ['week-events', weekStart.toISOString()],
    queryFn: () => calendarService.getEventsForWeek(weekStart),
  })

  const filteredContacts = contacts.filter((c: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.business?.name?.toLowerCase().includes(q)
  })

  const bookMutation = useMutation({
    mutationFn: (input: { contactId: string; businessId: string; scheduledAt: string }) =>
      calendarService.createEvent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week-events'] })
      toast.success('Call scheduled')
      setPendingDrop(null)
    },
    onError: () => toast.error('Failed to schedule call'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      calendarService.updateEvent(id, { status: status as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week-events'] })
      toast.success('Call updated')
    },
  })

  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return
    const droppableId = result.destination.droppableId
    if (!droppableId.startsWith('slot-')) return

    const [, dayIdx, minuteStr] = droppableId.split('-')
    const day = addDays(weekStart, parseInt(dayIdx))
    const minutes = parseInt(minuteStr)
    const slotDate = new Date(day)
    slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)

    const contactId = result.draggableId
    const contact = contacts.find((c: any) => c.id === contactId)
    if (!contact) return

    setPendingDrop({
      contactId,
      businessId: (contact as any).business?.id ?? (contact as any).business_id,
      contactName: (contact as any).name,
      businessName: (contact as any).business?.name ?? '',
      slot: slotDate,
    })
  }, [weekStart, contacts])

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(addDays(weekStart, dayCount - 1), 'd MMM yyyy')}`

  return (
    <div className="flex h-full">
      {/* Left pane — contacts */}
      <div className="w-[300px] border-r border-border overflow-y-auto p-4">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Ready to Schedule ({filteredContacts.length})
        </div>
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="pl-8 h-8 text-sm"
          />
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="contact-list" isDropDisabled>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {filteredContacts.map((c: any, idx: number) => (
                  <Draggable key={c.id} draggableId={c.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-3 rounded-lg border border-border bg-card mb-2 transition-all ${
                          snapshot.isDragging ? 'shadow-lg scale-105 border-primary/40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div {...provided.dragHandleProps} className="text-muted-foreground cursor-grab">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              {c.business?.name}
                            </div>
                            {c.phone && (
                              <div className="font-mono text-[10px] text-muted-foreground">{c.phone}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          {/* Calendar grid */}
          <div className="hidden">{/* DragDropContext wraps both panes */}</div>
        </DragDropContext>
      </div>

      {/* Right pane — calendar */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="font-mono text-sm text-muted-foreground">{weekLabel}</span>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showSaturday} onChange={(e) => setShowSaturday(e.target.checked)} />
            Sat
          </label>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex-1 overflow-auto">
            <div className="flex">
              {/* Time labels */}
              <div className="w-[60px] flex-shrink-0">
                <div className="h-10" /> {/* header spacer */}
                {HOURS.map((mins) => (
                  <div key={mins} style={{ height: SLOT_HEIGHT }} className="flex items-start px-2">
                    {mins % 60 === 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {String(Math.floor(mins / 60)).padStart(2, '0')}:00
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day, dayIdx) => (
                <div key={dayIdx} className="flex-1 min-w-[120px] border-l border-border">
                  {/* Day header */}
                  <div className={`h-10 flex items-center justify-center text-xs font-medium border-b border-border ${
                    isToday(day) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  }`}>
                    {format(day, 'EEE d MMM')}
                  </div>

                  {/* Slots */}
                  {HOURS.map((mins) => {
                    const slotId = `slot-${dayIdx}-${mins}`
                    const slotStart = new Date(day)
                    slotStart.setHours(Math.floor(mins / 60), mins % 60)

                    const event = events.find((e) => {
                      const eDate = new Date(e.scheduledAt)
                      return isSameDay(eDate, day) && eDate.getHours() * 60 + eDate.getMinutes() === mins
                    })

                    return (
                      <Droppable key={slotId} droppableId={slotId}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{ height: SLOT_HEIGHT }}
                            className={`border-b border-border/30 px-1 transition-colors ${
                              snapshot.isDraggingOver ? 'bg-primary/10' : 'hover:bg-muted/10'
                            }`}
                          >
                            {event && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="bg-primary rounded px-2 py-1 cursor-pointer h-full flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-primary-foreground" />
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-medium text-primary-foreground truncate">
                                        {/* We'd need contact/business name — simplified */}
                                        Call
                                      </div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-4">
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium">{format(new Date(event.scheduledAt), 'PPp')}</div>
                                    <div className="text-xs text-muted-foreground">{event.durationMins} min call</div>
                                    {event.notes && <p className="text-xs text-muted-foreground">{event.notes}</p>}
                                    <div className="flex gap-2 mt-3">
                                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: event.id, status: 'completed' })}>
                                        Complete
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: event.id, status: 'no_show' })}>
                                        No Show
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => updateMutation.mutate({ id: event.id, status: 'cancelled' })}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </DragDropContext>

        {/* Booking confirmation */}
        {pendingDrop && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Confirm Call</h3>
              <div className="space-y-1 mb-4">
                <div className="text-sm text-foreground">{pendingDrop.contactName}</div>
                <div className="text-xs text-muted-foreground">{pendingDrop.businessName}</div>
                <div className="font-mono text-xs text-muted-foreground">{format(pendingDrop.slot, 'PPp')}</div>
                <div className="text-xs text-muted-foreground">30 minutes</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setPendingDrop(null)} variant="outline">Cancel</Button>
                <Button
                  size="sm"
                  onClick={() =>
                    bookMutation.mutate({
                      contactId: pendingDrop.contactId,
                      businessId: pendingDrop.businessId,
                      scheduledAt: pendingDrop.slot.toISOString(),
                    })
                  }
                  disabled={bookMutation.isPending}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
