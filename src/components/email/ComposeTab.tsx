import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  Send, Clock, User, Mail, Phone, MessageSquare, ArrowRight,
  ChevronRight, Sparkles, Building2, CalendarDays, AlertCircle, Wand2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StageBadge } from '@/components/StatusBadge'
import type { CrmStage } from '@/types/acquira'
import { getEmailTemplates, type AiBlock } from '@/lib/queries/email-hub'
import { toast } from 'sonner'

// ── Template helpers (mirror TemplatesTab logic) ──
function replaceMergeTags(text: string, data: Record<string, string>): string {
  let result = text
  for (const [tag, value] of Object.entries(data)) {
    result = result.split(tag).join(value)
  }
  return result
}

function buildLiveData(business: any, ownerName?: string): Record<string, string> {
  const cls = Array.isArray(business?.classification)
    ? business.classification[0]
    : business?.classification
  return {
    '{{business_name}}':         business?.name ?? '',
    '{{owner_name}}':            ownerName?.split(' ')[0] ?? '{{owner_name}}',
    '{{city}}':                  business?.county ?? '',
    '{{state}}':                 business?.state_abbr ?? '',
    '{{rating}}':                business?.rating?.toString() ?? '?',
    '{{review_count}}':          business?.review_count?.toString() ?? '?',
    '{{years_in_business}}':     business?.founded_year
                                    ? `${new Date().getFullYear() - business.founded_year}+`
                                    : '?',
    '{{vertical}}':              cls?.vertical ?? '?',
    '{{service_area}}':          business?.county ?? '',
    '{{letter_number}}':         '1',
    '{{days_since_last_letter}}': '14',
    '{{sender_name}}':           'Keith Vasconcellos',
    '{{sender_phone}}':          '(617) 555-0192',
    '{{sender_email}}':          'keith@acquira.com',
  }
}

function fillBodyPlain(
  body: string,
  aiBlocks: AiBlock[],
  generated: Record<string, string>,
  mergeData: Record<string, string>,
): string {
  const parts = body.split(/({{AI_BLOCK_\d+}})/)
  const filled = parts.map((part) => {
    const m = part.match(/^{{AI_BLOCK_(\d+)}}$/)
    if (!m) return part
    const block = aiBlocks[parseInt(m[1]) - 1]
    if (!block) return ''
    return generated[block.id] ?? `[${block.label}]`
  }).join('')
  return replaceMergeTags(filled, mergeData)
}

// ── Mock communication data for demo ──
const MOCK_COMMS: Record<string, {
  lastContact: string
  lastMethod: 'email' | 'phone' | 'in-person'
  sentiment: 'positive' | 'neutral' | 'cold' | 'no-response'
  summary: string
  threadSnippets: Array<{ date: string; direction: 'out' | 'in'; preview: string }>
  suggestedResponses: Array<{ label: string; body: string; tone: 'warm' | 'direct' | 'follow-up' }>
}> = {}

function getMockComms(bizId: string, bizName: string) {
  if (MOCK_COMMS[bizId]) return MOCK_COMMS[bizId]

  const scenarios = [
    {
      lastContact: '2026-04-12T14:30:00Z',
      lastMethod: 'email' as const,
      sentiment: 'positive' as const,
      summary: `${bizName} expressed interest in discussing a potential transition. Owner mentioned retirement timeline of 18-24 months. Positive rapport established — they appreciated the personalized outreach referencing their community reputation.`,
      threadSnippets: [
        { date: '2026-04-08', direction: 'out' as const, preview: `Hi, I\'m reaching out regarding ${bizName}. We admire the business you\'ve built…` },
        { date: '2026-04-10', direction: 'in' as const, preview: `Thanks for reaching out. I\'ve been thinking about my options and would be open to a conversation…` },
        { date: '2026-04-12', direction: 'out' as const, preview: `Great to hear from you. I\'d love to schedule a call this week to learn more about…` },
      ],
      suggestedResponses: [
        { label: 'Schedule Call', tone: 'warm' as const, body: `Hi [Owner],\n\nThank you for being open to a conversation. I'd love to find a time that works for you this week.\n\nWould Tuesday or Thursday afternoon work? Happy to keep it informal — just 20-30 minutes to learn more about your journey with ${bizName}.\n\nBest regards` },
        { label: 'Send NDA', tone: 'direct' as const, body: `Hi [Owner],\n\nFollowing up on our conversation — I wanted to move things forward by sharing our mutual NDA for your review.\n\nThis is a standard non-disclosure agreement that protects both parties. Once signed, we can discuss financials and operations in more detail.\n\nPlease let me know if you have any questions.\n\nBest regards` },
        { label: 'Soft Check-in', tone: 'follow-up' as const, body: `Hi [Owner],\n\nJust wanted to check in and see if you had any questions after our last exchange. No pressure at all — I know these decisions take time.\n\nI'm here whenever you're ready to chat.\n\nWarm regards` },
      ],
    },
    {
      lastContact: '2026-04-02T09:00:00Z',
      lastMethod: 'email' as const,
      sentiment: 'neutral' as const,
      summary: `Initial outreach sent. ${bizName} acknowledged receipt but hasn\'t committed to a call. Response was polite but non-committal — may need a different angle or timing.`,
      threadSnippets: [
        { date: '2026-03-28', direction: 'out' as const, preview: `I noticed ${bizName} has been a cornerstone in the community for years…` },
        { date: '2026-04-02', direction: 'in' as const, preview: `Thanks for the note. I\'m not actively looking right now but appreciate you reaching out…` },
      ],
      suggestedResponses: [
        { label: 'Value-Add Follow-up', tone: 'warm' as const, body: `Hi [Owner],\n\nTotally understand — no rush at all. I wanted to share a quick market insight that might be relevant to ${bizName}.\n\n[Industry-specific insight here]\n\nHappy to be a resource anytime, even if the timing isn\'t right for a conversation now.\n\nBest` },
        { label: 'Gentle Re-engage', tone: 'follow-up' as const, body: `Hi [Owner],\n\nHope business is going well. I know you mentioned the timing wasn\'t right — just wanted to leave the door open.\n\nIf anything changes or you\'d just like to have an informal chat about your options, I\'m always happy to connect.\n\nBest regards` },
      ],
    },
    {
      lastContact: '2026-03-15T11:00:00Z',
      lastMethod: 'email' as const,
      sentiment: 'cold' as const,
      summary: `Two outreach emails sent with no response. ${bizName} may not have the right contact info on file, or the owner isn\'t interested. Consider trying a different contact method.`,
      threadSnippets: [
        { date: '2026-03-10', direction: 'out' as const, preview: `I\'m writing to introduce myself. We focus on acquiring and growing businesses like ${bizName}…` },
        { date: '2026-03-15', direction: 'out' as const, preview: `Following up on my previous email. I understand you\'re busy — just wanted to make sure this reached you…` },
      ],
      suggestedResponses: [
        { label: 'Final Attempt', tone: 'direct' as const, body: `Hi [Owner],\n\nI\'ve reached out a couple times and understand if the timing isn\'t right. I\'ll plan to circle back in a few months.\n\nIn the meantime, if you\'d ever like to have a no-obligation conversation about your business\'s future, my door is always open.\n\nBest regards` },
        { label: 'Try Phone', tone: 'follow-up' as const, body: `[INTERNAL NOTE: Consider calling ${bizName} directly. Email outreach hasn\'t generated a response after 2 attempts. Phone may be more effective for this type of business.]` },
      ],
    },
    {
      lastContact: '',
      lastMethod: 'email' as const,
      sentiment: 'no-response' as const,
      summary: `No outreach has been sent to ${bizName} yet. This is a newly identified target in the CRM. Consider sending an initial personalized letter.`,
      threadSnippets: [],
      suggestedResponses: [
        { label: 'Initial Outreach', tone: 'warm' as const, body: `Dear [Owner],\n\nI hope this message finds you well. My name is [Your Name], and I\'m part of a group focused on acquiring and growing established businesses like ${bizName}.\n\nI\'ve followed your work in [industry] and have tremendous respect for what you\'ve built. I\'d love the chance to introduce myself and learn more about your business journey.\n\nWould you be open to a brief conversation? No pressure — just an introduction.\n\nWarm regards` },
      ],
    },
  ]

  const idx = Math.abs(bizId.charCodeAt(0) + bizId.charCodeAt(1)) % scenarios.length
  MOCK_COMMS[bizId] = scenarios[idx]
  return MOCK_COMMS[bizId]
}

function daysSince(dateStr: string) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const SENTIMENT_CONFIG = {
  positive: { label: 'Positive', color: 'bg-success/20 text-success' },
  neutral: { label: 'Neutral', color: 'bg-warning/20 text-warning' },
  cold: { label: 'Cold', color: 'bg-destructive/20 text-destructive' },
  'no-response': { label: 'No Contact', color: 'bg-muted text-muted-foreground' },
}

export default function ComposeTab() {
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null)
  const [expandedResponse, setExpandedResponse] = useState<number | null>(null)

  const { data: crmBusinesses = [], isLoading } = useQuery({
    queryKey: ['crm-compose-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select(`
          id, name, crm_stage, phone, primary_email, address,
          classification:business_classifications!inner(vertical, business_type)
        `)
        .eq('in_crm', true)
        .neq('business_classifications.vertical', 'Out of Scope')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const selectedBiz = crmBusinesses.find((b: any) => b.id === selectedBizId)

  // Load contacts for selected business
  const { data: contacts = [] } = useQuery({
    queryKey: ['biz-contacts', selectedBizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('business_id', selectedBizId!)
        .order('is_owner', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!selectedBizId,
  })

  const comms = selectedBiz ? getMockComms(selectedBiz.id, selectedBiz.name) : null
  const daysSinceContact = comms?.lastContact ? daysSince(comms.lastContact) : null

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground font-mono text-sm">Loading CRM…</div>
  }

  return (
    <div className="flex h-full">
      {/* Left: CRM Business List */}
      <div className="w-[300px] border-r border-border overflow-y-auto">
        <div className="p-4">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
            CRM Businesses ({crmBusinesses.length})
          </div>
          {crmBusinesses.map((biz: any) => {
            const cls = Array.isArray(biz.classification) ? biz.classification[0] : biz.classification
            const isSelected = biz.id === selectedBizId
            const mockData = getMockComms(biz.id, biz.name)
            const sentiment = SENTIMENT_CONFIG[mockData.sentiment]
            const days = mockData.lastContact ? daysSince(mockData.lastContact) : null

            return (
              <button
                key={biz.id}
                onClick={() => { setSelectedBizId(biz.id); setExpandedResponse(null) }}
                className={`w-full text-left p-3 rounded-lg border mb-2 transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                    : 'bg-card border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{biz.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                      {cls?.business_type ?? cls?.vertical ?? '—'}
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground/40'}`} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StageBadge stage={biz.crm_stage as CrmStage} />
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${sentiment.color}`}>
                    {sentiment.label}
                  </span>
                  {days !== null && (
                    <span className={`text-[10px] font-mono ${days > 14 ? 'text-destructive' : days > 7 ? 'text-warning' : 'text-muted-foreground'}`}>
                      {days}d ago
                    </span>
                  )}
                </div>
              </button>
            )
          })}
          {crmBusinesses.length === 0 && (
            <p className="text-sm text-muted-foreground">No businesses in CRM</p>
          )}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div className="flex-1 overflow-y-auto">
        {selectedBiz && comms ? (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Business Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl text-foreground italic">{selectedBiz.name}</h2>
                <div className="text-sm text-muted-foreground mt-1">
                  {(selectedBiz as any).address ?? 'No address'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StageBadge stage={selectedBiz.crm_stage as CrmStage} />
                <span className={`text-xs font-mono px-2 py-1 rounded-full ${SENTIMENT_CONFIG[comms.sentiment].color}`}>
                  {SENTIMENT_CONFIG[comms.sentiment].label}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<CalendarDays className="w-4 h-4" />}
                label="Last Contact"
                value={comms.lastContact
                  ? new Date(comms.lastContact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Never'}
                sublabel={daysSinceContact !== null ? `${daysSinceContact} days ago` : undefined}
                alert={daysSinceContact !== null && daysSinceContact > 14}
              />
              <StatCard
                icon={<MessageSquare className="w-4 h-4" />}
                label="Exchanges"
                value={`${comms.threadSnippets.length}`}
                sublabel={`${comms.threadSnippets.filter(s => s.direction === 'in').length} inbound`}
              />
              <StatCard
                icon={<Mail className="w-4 h-4" />}
                label="Method"
                value={comms.lastMethod === 'email' ? 'Email' : comms.lastMethod === 'phone' ? 'Phone' : 'In Person'}
              />
            </div>

            {/* Conversation Summary */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-mono text-[10px] text-primary uppercase tracking-wider">Conversation Summary</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{comms.summary}</p>
            </div>

            {/* Contacts */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Contacts ({contacts.length})
                </span>
              </div>
              {contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-background-tertiary">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground flex items-center gap-2">
                          {c.name}
                          {c.is_owner && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">Owner</span>}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[c.role, c.email, c.phone].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No contacts on file. Add contacts from the business panel.</p>
              )}
            </div>

            {/* Communication Timeline */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Communication Timeline</span>
              </div>
              {comms.threadSnippets.length > 0 ? (
                <div className="space-y-0">
                  {comms.threadSnippets.map((snippet, i) => (
                    <div key={i} className="flex gap-3">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          snippet.direction === 'in' ? 'bg-success' : 'bg-primary'
                        }`} />
                        {i < comms.threadSnippets.length - 1 && (
                          <div className="w-px flex-1 bg-border my-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-mono font-medium ${
                            snippet.direction === 'in' ? 'text-success' : 'text-primary'
                          }`}>
                            {snippet.direction === 'in' ? '← Received' : '→ Sent'}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {new Date(snippet.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed">{snippet.preview}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="w-5 h-5 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No communications yet</p>
                </div>
              )}
            </div>

            {/* Pre-Prepped Responses */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-mono text-[10px] text-primary uppercase tracking-wider">Suggested Responses</span>
              </div>
              <div className="space-y-2">
                {comms.suggestedResponses.map((resp, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => setExpandedResponse(expandedResponse === i ? null : i)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          resp.tone === 'warm' ? 'bg-success/20 text-success' :
                          resp.tone === 'direct' ? 'bg-primary/20 text-primary' :
                          'bg-warning/20 text-warning'
                        }`}>
                          {resp.tone}
                        </span>
                        <span className="text-sm font-medium text-foreground">{resp.label}</span>
                      </div>
                      <ArrowRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedResponse === i ? 'rotate-90' : ''}`} />
                    </button>
                    {expandedResponse === i && (
                      <div className="px-3 pb-3 border-t border-border pt-3">
                        <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                          {resp.body}
                        </pre>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" className="gap-1.5" onClick={() => {
                            navigator.clipboard.writeText(resp.body)
                          }}>
                            <Send className="w-3 h-3" /> Copy & Use
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Building2 className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm">Select a business to view communication details</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stat Card ── */
function StatCard({ icon, label, value, sublabel, alert }: {
  icon: React.ReactNode; label: string; value: string; sublabel?: string; alert?: boolean
}) {
  return (
    <div className={`rounded-lg border p-3 ${alert ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={alert ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-mono font-medium ${alert ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
      {sublabel && <div className="text-[11px] font-mono text-muted-foreground mt-0.5">{sublabel}</div>}
    </div>
  )
}
