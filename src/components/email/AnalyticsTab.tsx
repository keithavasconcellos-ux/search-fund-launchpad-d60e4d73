import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDistinctVerticals, type EmailAnalytics } from '@/lib/queries/email-hub'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIME_RANGES = [
  { label: 'Last 7d', value: 7 },
  { label: 'Last 30d', value: 30 },
  { label: 'Last 90d', value: 90 },
  { label: 'All time', value: 3650 },
]

const PLACEHOLDER_INDUSTRIES = [
  { name: 'HVAC', baseRate: 14.2 },
  { name: 'Plumbing', baseRate: 11.8 },
  { name: 'Electrical', baseRate: 9.4 },
  { name: 'Landscaping', baseRate: 7.6 },
  { name: 'Auto Repair', baseRate: 6.1 },
  { name: 'Roofing', baseRate: 5.3 },
]

function buildPlaceholder(days: number, vertical: string, letter: string): EmailAnalytics {
  // Scale volume with the selected time range
  const perDay = 42
  const baseSent = Math.round(perDay * Math.min(days, 365))
  const verticalMultiplier = vertical === '__all__' ? 1 : 0.35
  const letterMultiplier = letter === '__all__' ? 1 : 0.28
  const sent = Math.max(12, Math.round(baseSent * verticalMultiplier * letterMultiplier))

  const opened = Math.round(sent * 0.46)
  const replied = Math.round(sent * 0.092)
  const positiveReplies = Math.round(replied * 0.38)
  const crmEntered = Math.round(positiveReplies * 0.72)

  const industries = (vertical === '__all__'
    ? PLACEHOLDER_INDUSTRIES
    : PLACEHOLDER_INDUSTRIES.filter((i) => i.name.toLowerCase() === vertical.toLowerCase()).concat(
        PLACEHOLDER_INDUSTRIES.slice(0, 3),
      )
  ).slice(0, 6)

  const byIndustry = industries.map((i) => {
    const iSent = Math.max(8, Math.round(sent / industries.length))
    const rate = Math.round(i.baseRate * 10) / 10
    const iReplied = Math.round((iSent * rate) / 100)
    return { name: i.name, sent: iSent, replied: iReplied, rate }
  })

  const letters = letter === '__all__' ? [1, 2, 3, 4, 5] : [parseInt(letter)]
  const letterRates: Record<number, number> = { 1: 4.8, 2: 8.2, 3: 11.6, 4: 9.1, 5: 6.3 }
  const byLetter = letters.map((n) => {
    const lSent = Math.max(6, Math.round(sent / letters.length))
    const rate = letterRates[n] ?? 7
    const lReplied = Math.round((lSent * rate) / 100)
    return { name: `Letter ${n}`, sent: lSent, replied: lReplied, rate }
  })

  return { sent, opened, replied, positiveReplies, crmEntered, byIndustry, byLetter }
}

export default function AnalyticsTab() {
  const [days, setDays] = useState(30)
  const [vertical, setVertical] = useState<string>('__all__')
  const [letter, setLetter] = useState<string>('__all__')

  const { data: verticals = [] } = useQuery({
    queryKey: ['distinct-verticals'],
    queryFn: getDistinctVerticals,
  })

  const analytics = useMemo(
    () => buildPlaceholder(days, vertical, letter),
    [days, vertical, letter],
  )

  const funnelSteps = [
    { label: 'Sent', count: analytics.sent, rate: 100 },
    { label: 'Opened', count: analytics.opened, rate: analytics.sent > 0 ? Math.round((analytics.opened / analytics.sent) * 100) : 0 },
    { label: 'Replied', count: analytics.replied, rate: analytics.sent > 0 ? Math.round((analytics.replied / analytics.sent) * 100) : 0 },
    { label: 'Positive', count: analytics.positiveReplies, rate: analytics.sent > 0 ? Math.round((analytics.positiveReplies / analytics.sent) * 100) : 0 },
    { label: 'CRM Entered', count: analytics.crmEntered, rate: analytics.sent > 0 ? Math.round((analytics.crmEntered / analytics.sent) * 100) : 0 },
  ]

  return (
    <div className="p-6 max-w-4xl overflow-y-auto">
      <div className="mb-4 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200 font-mono text-[11px] uppercase tracking-wider">
        Showing placeholder data — wire up real analytics when ready
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                days === r.value ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Select value={vertical} onValueChange={setVertical}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Vertical" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Verticals</SelectItem>
            {verticals.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={letter} onValueChange={setLetter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Letter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Letters</SelectItem>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>Letter {n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: `Emails Sent (${days}d)`, value: analytics.sent.toString() },
          { label: 'Open Rate', value: analytics.sent > 0 ? `${Math.round((analytics.opened / analytics.sent) * 1000) / 10}%` : '—' },
          { label: 'Response Rate', value: analytics.sent > 0 ? `${Math.round((analytics.replied / analytics.sent) * 1000) / 10}%` : '—' },
          { label: 'Positive Rate', value: analytics.sent > 0 ? `${Math.round((analytics.positiveReplies / analytics.sent) * 1000) / 10}%` : '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-lg p-5 border border-border">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</div>
            <div className="text-2xl font-semibold text-foreground font-mono">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div className="bg-card rounded-lg p-5 border border-border mb-6">
        <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4">Conversion Funnel</h3>
        <div className="space-y-3">
          {funnelSteps.map((step, i) => {
            const prevCount = i > 0 ? funnelSteps[i - 1].count : step.count
            const convRate = prevCount > 0 ? Math.round((step.count / prevCount) * 100) : 0
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-24">{step.label}</span>
                <div className="flex-1 bg-muted/20 rounded-full h-3">
                  <div
                    className="bg-primary rounded-full h-3 transition-all"
                    style={{ width: `${step.rate}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-foreground w-12 text-right">{step.count}</span>
                {i > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground w-12">{convRate}%</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* By Industry + By Letter */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-lg p-5 border border-border">
          <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4">
            Response Rate by Industry
          </h3>
          <div className="space-y-3">
            {analytics.byIndustry.length === 0 && (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
            {analytics.byIndustry.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-20 truncate">{item.name}</span>
                <div className="flex-1 bg-muted/20 rounded-full h-2">
                  <div className="bg-primary rounded-full h-2" style={{ width: `${Math.min((item.rate / 30) * 100, 100)}%` }} />
                </div>
                <span className="font-mono text-xs text-foreground w-12 text-right">{item.rate}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-lg p-5 border border-border">
          <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-4">
            Response Rate by Letter
          </h3>
          <div className="space-y-3">
            {analytics.byLetter.length === 0 && (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
            {analytics.byLetter.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground w-20 truncate">{item.name}</span>
                <div className="flex-1 bg-muted/20 rounded-full h-2">
                  <div className="bg-teal-500 rounded-full h-2" style={{ width: `${Math.min((item.rate / 30) * 100, 100)}%` }} />
                </div>
                <span className="font-mono text-xs text-foreground w-12 text-right">{item.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
