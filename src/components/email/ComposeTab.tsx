import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getComposeQueue } from '@/lib/queries/email-hub'
import { emailService } from '@/lib/email/emailService'
import { Send, Sparkles, Clock, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'

export default function ComposeTab() {
  const queryClient = useQueryClient()
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['compose-queue'],
    queryFn: getComposeQueue,
  })

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [scheduleDateOpen, setScheduleDateOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>()
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [batchScheduleOpen, setBatchScheduleOpen] = useState(false)

  const selectedThread = queue.find((t: any) => t.id === selectedThreadId) ?? queue[0]

  const sendMutation = useMutation({
    mutationFn: async (thread: any) => {
      return emailService.sendEmail({
        businessId: thread.business_id,
        contactId: thread.contact_id,
        templateId: thread.template_id,
        letterNumber: thread.letter_number,
        subject: thread.subject,
        bodyText: thread.body_text ?? '',
        bodyHtml: thread.body_html,
        metadata: thread.metadata,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compose-queue'] })
      toast.success('Email sent')
    },
    onError: () => toast.error('Failed to send'),
  })

  const scheduleMutation = useMutation({
    mutationFn: async ({ thread, at }: { thread: any; at: string }) => {
      return emailService.scheduleEmail(
        {
          businessId: thread.business_id,
          contactId: thread.contact_id,
          templateId: thread.template_id,
          letterNumber: thread.letter_number,
          subject: thread.subject,
          bodyText: thread.body_text ?? '',
          bodyHtml: thread.body_html,
          metadata: thread.metadata,
        },
        at
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compose-queue'] })
      toast.success('Email scheduled')
    },
  })

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleScheduleConfirm = (thread: any) => {
    if (!scheduleDate) return
    const [h, m] = scheduleTime.split(':')
    const dt = new Date(scheduleDate)
    dt.setHours(parseInt(h), parseInt(m))
    scheduleMutation.mutate({ thread, at: dt.toISOString() })
    setScheduleDateOpen(false)
  }

  const handleBatchSend = async () => {
    const items = queue.filter((t: any) => checkedIds.has(t.id))
    for (const item of items) {
      await sendMutation.mutateAsync(item)
    }
    setCheckedIds(new Set())
  }

  const handleBatchSchedule = async () => {
    if (!scheduleDate) return
    const [h, m] = scheduleTime.split(':')
    const dt = new Date(scheduleDate)
    dt.setHours(parseInt(h), parseInt(m))
    const at = dt.toISOString()

    const items = queue.filter((t: any) => checkedIds.has(t.id))
    for (const item of items) {
      await scheduleMutation.mutateAsync({ thread: item, at })
    }
    setCheckedIds(new Set())
    setBatchScheduleOpen(false)
  }

  const personalizationFields = selectedThread?.metadata?.personalization_fields as string[] | undefined

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm">Loading queue…</div>
  }

  return (
    <div className="flex h-full">
      {/* Queue */}
      <div className="w-[280px] border-r border-border overflow-y-auto relative">
        <div className="p-4">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            Target Queue ({queue.length})
          </div>
          {queue.length === 0 && (
            <p className="text-sm text-muted-foreground">No drafts in queue</p>
          )}
          {queue.map((item: any) => {
            const isChecked = checkedIds.has(item.id)
            const isSelected = item.id === selectedThread?.id

            return (
              <div
                key={item.id}
                className={`p-3 rounded-lg border mb-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCheck(item.id) }}
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {isChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0" onClick={() => setSelectedThreadId(item.id)}>
                    <div className="text-sm font-medium text-foreground truncate">
                      {item.business?.name ?? 'Unknown'}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      {item.business?.address ?? ''} · Letter {item.letter_number ?? '?'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Sparkles className="w-3 h-3 text-primary" />
                      <span className="font-mono text-[10px] text-primary">
                        {item.status === 'draft' ? 'AI draft ready' : item.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Batch actions */}
        {checkedIds.size >= 2 && (
          <div className="sticky bottom-0 bg-card border-t border-border p-3 flex flex-col gap-2">
            <Button size="sm" onClick={handleBatchSend} disabled={sendMutation.isPending} className="w-full gap-2">
              <Send className="w-3.5 h-3.5" />
              Send {checkedIds.size} selected
            </Button>
            <Popover open={batchScheduleOpen} onOpenChange={setBatchScheduleOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="w-full gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Schedule {checkedIds.size} selected
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4">
                <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} />
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="bg-muted rounded px-2 py-1 text-sm font-mono"
                  />
                  <Button size="sm" onClick={handleBatchSchedule} disabled={!scheduleDate}>
                    Confirm
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-1 p-6 max-w-2xl overflow-y-auto">
        {selectedThread ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-12">To</label>
              <div className="flex-1 bg-muted/30 rounded-md px-3 py-2 text-sm text-foreground">
                {selectedThread.contact?.email ?? selectedThread.business?.name ?? '—'}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider w-12">Subj</label>
              <div className="flex-1 bg-muted/30 rounded-md px-3 py-2 text-sm text-foreground">
                {selectedThread.subject}
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 min-h-[300px]">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {renderPersonalizedBody(selectedThread.body_text ?? '', personalizationFields)}
              </p>
              {personalizationFields && personalizationFields.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-primary">
                  <Sparkles className="w-3 h-3" />
                  AI-personalized — {personalizationFields.length} fields from business profile
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => sendMutation.mutate(selectedThread)}
                disabled={sendMutation.isPending}
                className="gap-2"
                size="sm"
              >
                <Send className="w-3.5 h-3.5" />
                Send Now
              </Button>
              <Popover open={scheduleDateOpen} onOpenChange={setScheduleDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    Schedule
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4">
                  <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} />
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="bg-muted rounded px-2 py-1 text-sm font-mono"
                    />
                    <Button size="sm" onClick={() => handleScheduleConfirm(selectedThread)} disabled={!scheduleDate}>
                      Confirm
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No drafts to compose
          </div>
        )}
      </div>
    </div>
  )
}

function renderPersonalizedBody(body: string, fields?: string[]) {
  if (!fields || fields.length === 0) return body

  // Split body by personalized segments and wrap them
  let result: (string | JSX.Element)[] = [body]
  for (const field of fields) {
    const newResult: (string | JSX.Element)[] = []
    for (const part of result) {
      if (typeof part !== 'string') {
        newResult.push(part)
        continue
      }
      const idx = part.indexOf(field)
      if (idx === -1) {
        newResult.push(part)
      } else {
        if (idx > 0) newResult.push(part.slice(0, idx))
        newResult.push(
          <span key={field} className="bg-primary/20 px-0.5 rounded">
            {field}
          </span>
        )
        if (idx + field.length < part.length) newResult.push(part.slice(idx + field.length))
      }
    }
    result = newResult
  }
  return <>{result}</>
}
