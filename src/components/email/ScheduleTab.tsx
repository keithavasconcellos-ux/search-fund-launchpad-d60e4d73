import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarService } from '@/lib/calendar/calendarService'
import { getBusinesses, getClassificationTaxonomy } from '@/lib/queries/businesses'
import { supabase } from '@/integrations/supabase/client'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Search,
  GripVertical,
  MapPin,
  Filter,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format, startOfWeek, addDays, addWeeks, isSameDay, isToday } from 'date-fns'
import type { CrmStage } from '@/types/acquira'

const HOURS = Array.from({ length: 20 }, (_, i) => 8 * 60 + i * 30) // 08:00–17:30 in minutes
const SLOT_HEIGHT = 48

const CRM_STAGES: { value: CrmStage; label: string }[] = [
  { value: 'identified', label: 'Identified' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'nda_signed', label: 'NDA Signed' },
  { value: 'cim_received', label: 'CIM Received' },
  { value: 'active_loi', label: 'Active LOI' },
  { value: 'passed', label: 'Passed' },
]

const STAGE_COLORS: Record<string, string> = {
  identified: 'bg-muted/40 text-muted-foreground',
  contacted: 'bg-blue-500/15 text-blue-300',
  engaged: 'bg-emerald-500/15 text-emerald-300',
  nda_signed: 'bg-violet-500/15 text-violet-300',
  cim_received: 'bg-amber-500/15 text-amber-300',
  active_loi: 'bg-orange-500/15 text-orange-300',
  passed: 'bg-red-500/15 text-red-300',
}

export default function ScheduleTab() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  )
  const [showSaturday, setShowSaturday] = useState(false)
  const [pendingDrop, setPendingDrop] = useState<{
    businessId: string
    contactId: string | null
    contactName: string
    businessName: string
    slot: Date
  } | null>(null)

  // ── Filters ────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [crmStage, setCrmStage] = useState<string>('__all__')
  const [vertical, setVertical] = useState<string>('__all__')
  const [category, setCategory] = useState<string>('__all__')
  const [businessType, setBusinessType] = useState<string>('__all__')
  const [stateAbbr, setStateAbbr] = useState<string>('__all__')
  const [county, setCounty] = useState<string>('__all__')

  const dayCount = showSaturday ? 6 : 5
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i)),
    [weekStart, dayCount],
  )

  // Taxonomy for vertical → category → business_type cascading
  const { data: taxonomy = {} } = useQuery({
    queryKey: ['classification-taxonomy'],
    queryFn: getClassificationTaxonomy,
  })

  const verticalOptions = useMemo(() => Object.keys(taxonomy).sort(), [taxonomy])
  const categoryOptions = useMemo(
    () => (vertical !== '__all__' && taxonomy[vertical] ? Object.keys(taxonomy[vertical]).sort() : []),
    [vertical, taxonomy],
  )
  const typeOptions = useMemo(
    () =>
      vertical !== '__all__' && category !== '__all__' && taxonomy[vertical]?.[category]
        ? taxonomy[vertical][category]
        : [],
    [vertical, category, taxonomy],
  )

  // Distinct states & counties from current businesses set (for location filters)
  const { data: locationOptions = { states: [], counties: [] } } = useQuery({
    queryKey: ['schedule-locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('state_abbr, county')
        .not('state_abbr', 'is', null)
        .limit(2000)
      if (error) throw error
      const states = new Set<string>()
      const counties = new Set<string>()
      for (const r of (data ?? []) as any[]) {
        if (r.state_abbr) states.add(r.state_abbr)
        if (r.county) counties.add(r.county)
      }
      return {
        states: Array.from(states).sort(),
        counties: Array.from(counties).sort(),
      }
    },
  })

  // Determine if we have enough filters to load tiles (mirrors Library guard)
  const activeFilterCount = [
    search,
    crmStage !== '__all__' ? crmStage : '',
    vertical !== '__all__' ? vertical : '',
    category !== '__all__' ? category : '',
    businessType !== '__all__' ? businessType : '',
    stateAbbr !== '__all__' ? stateAbbr : '',
    county !== '__all__' ? county : '',
  ].filter(Boolean).length

  const canLoad = activeFilterCount >= 1

  // ── Businesses (tiles) ─────────────────────────────────
  const { data: businesses = [], isLoading: loadingBusinesses } = useQuery({
    queryKey: [
      'schedule-businesses',
      crmStage,
      vertical,
      category,
      businessType,
      stateAbbr,
      county,
      search,
    ],
    enabled: canLoad,
    queryFn: () =>
      getBusinesses({
        crm_stage: crmStage !== '__all__' ? (crmStage as CrmStage) : undefined,
        vertical: vertical !== '__all__' ? vertical : undefined,
        category: category !== '__all__' ? category : undefined,
        business_type: businessType !== '__all__' ? businessType : undefined,
        state_abbr: stateAbbr !== '__all__' ? stateAbbr : undefined,
        county: county !== '__all__' ? county : undefined,
        search: search || undefined,
        limit: 200,
      }),
  })

  // Pull primary contacts for the loaded businesses so drops can attach a contact
  const businessIds = useMemo(
    () => (businesses as any[]).map((b) => b.id),
    [businesses],
  )

  const { data: contactsByBiz = {} } = useQuery({
    queryKey: ['schedule-contacts-for', businessIds],
    enabled: businessIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, business_id, is_owner')
        .in('business_id', businessIds)
      if (error) throw error
      const map: Record<string, { id: string; name: string }> = {}
      for (const c of (data ?? []) as any[]) {
        // Prefer owner; first one wins otherwise
        if (!map[c.business_id] || c.is_owner) {
          map[c.business_id] = { id: c.id, name: c.name }
        }
      }
      return map
    },
  })

  // ── Calendar events ────────────────────────────────────
  const { data: events = [] } = useQuery({
    queryKey: ['week-events', weekStart.toISOString()],
    queryFn: () => calendarService.getEventsForWeek(weekStart),
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

  const handleDragEnd = useCallback(
    (result: any) => {
      if (!result.destination) return
      const droppableId = result.destination.droppableId
      if (!droppableId.startsWith('slot-')) return

      const [, dayIdx, minuteStr] = droppableId.split('-')
      const day = addDays(weekStart, parseInt(dayIdx))
      const minutes = parseInt(minuteStr)
      const slotDate = new Date(day)
      slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)

      const businessId = result.draggableId.replace('biz-', '')
      const business = (businesses as any[]).find((b) => b.id === businessId)
      if (!business) return

      const contact = contactsByBiz[businessId] ?? null

      setPendingDrop({
        businessId,
        contactId: contact?.id ?? null,
        contactName: contact?.name ?? '—',
        businessName: business.name,
        slot: slotDate,
      })
    },
    [weekStart, businesses, contactsByBiz],
  )

  const clearFilters = () => {
    setSearch('')
    setCrmStage('__all__')
    setVertical('__all__')
    setCategory('__all__')
    setBusinessType('__all__')
    setStateAbbr('__all__')
    setCounty('__all__')
  }

  const weekLabel = `${format(weekStart, 'd MMM')} – ${format(addDays(weekStart, dayCount - 1), 'd MMM yyyy')}`

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex h-full">
        {/* Left pane — business tiles + filters */}
        <div className="w-[340px] border-r border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3 h-3" />
                Filter Businesses
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search business…"
                className="pl-8 h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={crmStage} onValueChange={setCrmStage}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="CRM Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Stages</SelectItem>
                  {CRM_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={stateAbbr}
                onValueChange={(v) => {
                  setStateAbbr(v)
                  setCounty('__all__')
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All States</SelectItem>
                  {locationOptions.states.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={county} onValueChange={setCounty}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="County" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Counties</SelectItem>
                {locationOptions.counties.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Vertical hierarchy */}
            <Select
              value={vertical}
              onValueChange={(v) => {
                setVertical(v)
                setCategory('__all__')
                setBusinessType('__all__')
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Vertical" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Verticals</SelectItem>
                {verticalOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {vertical !== '__all__' && categoryOptions.length > 0 && (
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v)
                  setBusinessType('__all__')
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {category !== '__all__' && typeOptions.length > 0 && (
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Business Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Types</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tiles */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Businesses</span>
              <span>{(businesses as any[]).length}</span>
            </div>

            {!canLoad ? (
              <div className="text-xs text-muted-foreground p-6 text-center border border-dashed border-border rounded-lg">
                Apply at least one filter to load businesses.
              </div>
            ) : loadingBusinesses ? (
              <div className="text-xs text-muted-foreground p-4 text-center font-mono">
                Loading…
              </div>
            ) : (businesses as any[]).length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center">
                No businesses match these filters.
              </div>
            ) : (
              <Droppable droppableId="biz-list" isDropDisabled>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {(businesses as any[]).map((b, idx) => {
                      const cls = b.classification?.[0] ?? b.classification
                      const contact = contactsByBiz[b.id]
                      return (
                        <Draggable key={b.id} draggableId={`biz-${b.id}`} index={idx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`p-3 rounded-lg border bg-card transition-all ${
                                snapshot.isDragging
                                  ? 'shadow-lg border-primary/60 ring-1 ring-primary/30'
                                  : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <div
                                  {...provided.dragHandleProps}
                                  className="text-muted-foreground cursor-grab pt-0.5"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-foreground truncate">
                                    {b.name}
                                  </div>
                                  {(cls?.vertical || cls?.business_type) && (
                                    <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                                      {cls?.business_type ?? cls?.category ?? cls?.vertical}
                                    </div>
                                  )}
                                  {(b.county || b.state_abbr) && (
                                    <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground mt-0.5">
                                      <MapPin className="w-2.5 h-2.5" />
                                      {[b.county, b.state_abbr].filter(Boolean).join(', ')}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className={`text-[9px] font-mono px-1.5 py-0 border-0 ${
                                        STAGE_COLORS[b.crm_stage] ?? 'bg-muted/40'
                                      }`}
                                    >
                                      {b.crm_stage.replace(/_/g, ' ')}
                                    </Badge>
                                    {contact && (
                                      <span className="text-[9px] font-mono text-muted-foreground truncate">
                                        · {contact.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )}
          </div>
        </div>

        {/* Right pane — calendar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="font-mono text-sm text-muted-foreground">{weekLabel}</span>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showSaturday}
                onChange={(e) => setShowSaturday(e.target.checked)}
              />
              Sat
            </label>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="flex">
              {/* Time labels */}
              <div className="w-[60px] flex-shrink-0">
                <div className="h-10" />
                {HOURS.map((mins) => (
                  <div
                    key={mins}
                    style={{ height: SLOT_HEIGHT }}
                    className="flex items-start px-2"
                  >
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
                  <div
                    className={`h-10 flex items-center justify-center text-xs font-medium border-b border-border ${
                      isToday(day) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {format(day, 'EEE d MMM')}
                  </div>

                  {HOURS.map((mins) => {
                    const slotId = `slot-${dayIdx}-${mins}`
                    const event = events.find((e) => {
                      const eDate = new Date(e.scheduledAt)
                      return (
                        isSameDay(eDate, day) &&
                        eDate.getHours() * 60 + eDate.getMinutes() === mins
                      )
                    })

                    return (
                      <Droppable key={slotId} droppableId={slotId}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{ height: SLOT_HEIGHT }}
                            className={`border-b border-border/30 px-1 transition-colors ${
                              snapshot.isDraggingOver
                                ? 'bg-primary/15 ring-1 ring-inset ring-primary/40'
                                : 'hover:bg-muted/10'
                            }`}
                          >
                            {event && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="bg-primary rounded px-2 py-1 cursor-pointer h-full flex items-center gap-1.5">
                                    <Phone className="w-3 h-3 text-primary-foreground" />
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-medium text-primary-foreground truncate">
                                        Call
                                      </div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-4">
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium">
                                      {format(new Date(event.scheduledAt), 'PPp')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {event.durationMins} min call
                                    </div>
                                    {event.notes && (
                                      <p className="text-xs text-muted-foreground">{event.notes}</p>
                                    )}
                                    <div className="flex gap-2 mt-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          updateMutation.mutate({
                                            id: event.id,
                                            status: 'completed',
                                          })
                                        }
                                      >
                                        Complete
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          updateMutation.mutate({
                                            id: event.id,
                                            status: 'no_show',
                                          })
                                        }
                                      >
                                        No Show
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          updateMutation.mutate({
                                            id: event.id,
                                            status: 'cancelled',
                                          })
                                        }
                                      >
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

          {/* Booking confirmation */}
          {pendingDrop && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4">
                <h3 className="text-sm font-medium text-foreground mb-3">Confirm Call</h3>
                <div className="space-y-1 mb-4">
                  <div className="text-sm text-foreground">{pendingDrop.businessName}</div>
                  <div className="text-xs text-muted-foreground">
                    Contact: {pendingDrop.contactName}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {format(pendingDrop.slot, 'PPp')}
                  </div>
                  <div className="text-xs text-muted-foreground">30 minutes</div>
                </div>
                {!pendingDrop.contactId && (
                  <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2 mb-3">
                    No contact on file for this business — add one in CRM before booking.
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button size="sm" onClick={() => setPendingDrop(null)} variant="outline">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!pendingDrop.contactId || bookMutation.isPending}
                    onClick={() =>
                      pendingDrop.contactId &&
                      bookMutation.mutate({
                        contactId: pendingDrop.contactId,
                        businessId: pendingDrop.businessId,
                        scheduledAt: pendingDrop.slot.toISOString(),
                      })
                    }
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DragDropContext>
  )
}
