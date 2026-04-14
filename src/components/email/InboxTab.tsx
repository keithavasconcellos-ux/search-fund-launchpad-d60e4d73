import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getInboxThreads } from '@/lib/queries/email-hub'
import { formatDistanceToNow } from 'date-fns'
import { Mail, ArrowRight, UserCheck, Reply, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { updateCrmStage } from '@/lib/queries/businesses'
import { toast } from 'sonner'

const classificationColors: Record<string, string> = {
  positive: 'bg-green-500/20 text-green-400',
  negative: 'bg-red-500/20 text-red-400',
  neutral: 'bg-yellow-500/20 text-yellow-400',
  out_of_office: 'bg-muted text-muted-foreground',
  not_classified: 'bg-muted text-muted-foreground',
}

const classificationLabels: Record<string, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
  out_of_office: 'Out of Office',
  not_classified: 'Unclassified',
}

export default function InboxTab() {
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ['inbox-threads'],
    queryFn: getInboxThreads,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedThread = threads.find((t: any) => t.id === selectedId) ?? threads[0]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm">
        Loading inbox…
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Mail className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">No replies yet</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left pane — thread list */}
      <div className="w-[350px] border-r border-border overflow-y-auto">
        {threads.map((thread: any) => {
          const isSelected = thread.id === (selectedThread?.id ?? null)
          const cls = thread.response_classification ?? 'not_classified'
          const contactName = thread.contact?.name ?? 'Unknown'
          const businessName = thread.business?.name ?? 'Unknown'
          const hasBeenRead = !!thread.opened_at

          return (
            <div
              key={thread.id}
              onClick={() => setSelectedId(thread.id)}
              className={`px-4 py-3 cursor-pointer border-b border-border/50 transition-colors ${
                isSelected
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {!hasBeenRead && (
                  <span className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-foreground truncate">{contactName}</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate">· {businessName}</span>
              </div>
              <div className="text-sm text-muted-foreground truncate mb-1">{thread.subject}</div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${classificationColors[cls]}`}>
                  {classificationLabels[cls]}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                  {thread.replied_at
                    ? formatDistanceToNow(new Date(thread.replied_at), { addSuffix: true })
                    : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Right pane — thread detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedThread ? (
          <ThreadDetail thread={selectedThread} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  )
}

function ThreadDetail({ thread }: { thread: any }) {
  const [promotionDismissed, setPromotionDismissed] = useState(false)
  const contactName = thread.contact?.name ?? 'Unknown'
  const businessName = thread.business?.name ?? 'Unknown'
  const crmStage = thread.business?.crm_stage
  const showPromotion =
    thread.response_classification === 'positive' &&
    crmStage === 'contacted' &&
    !promotionDismissed

  const handlePromote = async () => {
    try {
      await updateCrmStage(thread.business.id, 'contacted', 'engaged', '')
      toast.success(`${businessName} promoted to Engaged`)
      setPromotionDismissed(true)
    } catch {
      toast.error('Failed to promote stage')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Auto-promotion banner */}
      {showPromotion && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-green-300 font-medium">
              Positive reply detected — promote {businessName} to Engaged?
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPromotionDismissed(true)} className="text-xs">
            Dismiss
          </Button>
          <Button size="sm" onClick={handlePromote} className="text-xs">
            Confirm
          </Button>
        </div>
      )}

      {/* Subject header */}
      <h2 className="text-lg font-medium text-foreground mb-1">{thread.subject}</h2>
      <p className="font-mono text-[10px] text-muted-foreground mb-6">
        {contactName} · {businessName}
      </p>

      {/* Message bubbles */}
      <div className="space-y-4">
        {/* Outbound */}
        {thread.body_text && (
          <div className="flex justify-end">
            <div className="bg-primary/20 rounded-lg p-4 max-w-[85%]">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] text-primary">You</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {thread.sent_at ? new Date(thread.sent_at).toLocaleString() : ''}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {thread.body_text}
              </p>
            </div>
          </div>
        )}

        {/* Inbound reply */}
        {thread.reply_body && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-lg p-4 max-w-[85%]">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[10px] text-foreground">{contactName}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {thread.replied_at ? new Date(thread.replied_at).toLocaleString() : ''}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {thread.reply_body}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick action bar */}
      <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Reply className="w-3.5 h-3.5" />
          Reply
        </Button>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <ArrowRight className="w-3.5 h-3.5" />
          Move to Next Stage
        </Button>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          Flag for Review
        </Button>
      </div>
    </div>
  )
}
