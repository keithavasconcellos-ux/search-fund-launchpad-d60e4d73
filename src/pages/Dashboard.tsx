import { ArrowUp, ArrowDown, RefreshCw, Mail, Eye, MessageSquare, FileText } from 'lucide-react';
import { mockBusinesses, mockActivities, formatRevenue, pipelineStages } from '@/lib/mockData';
import { StageBadge } from '@/components/StatusBadge';

const kpis = [
  { label: 'Businesses Tracked', value: '1,247', change: '↑ 84 this week', positive: true },
  { label: 'Active Pipeline', value: '38', change: '↑ 5 new', positive: true },
  { label: 'Response Rate (30d)', value: '12.4%', change: '↑ 1.8pp', positive: true },
  { label: 'Positive Responses', value: '4.1%', change: '↓ 0.3pp', positive: false },
];

const funnelData = [
  { stage: 'Identified', count: 1247 },
  { stage: 'Contacted', count: 776 },
  { stage: 'Engaged', count: 96 },
  { stage: 'NDA Signed', count: 38 },
  { stage: 'CIM Received', count: 12 },
  { stage: 'Active LOI', count: 2 },
];

const needsAttention = mockBusinesses.filter(b => ['Engaged', 'NDA Signed'].includes(b.crmStage || ''));

export default function Dashboard() {
  return (
    <div className="p-8 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-foreground italic">Good morning, J.</h1>
          <p className="font-mono text-xs text-text-tertiary mt-1 uppercase tracking-wider">
            Week 21 · 142 days into search · Last refreshed: 9:14am
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-tertiary text-muted-foreground text-sm hover:bg-background-quaternary transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-lg p-5 border border-border">
            <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-2">{kpi.label}</div>
            <div className="text-2xl font-semibold text-foreground font-mono">{kpi.value}</div>
            <div className={`text-xs mt-1 font-mono ${kpi.positive ? 'text-success' : 'text-destructive'}`}>
              {kpi.change}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Pipeline Funnel */}
        <div className="bg-card rounded-lg p-5 border border-border">
          <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Pipeline Funnel</h2>
          <div className="space-y-2.5">
            {funnelData.map((item, i) => (
              <div key={item.stage} className="flex items-center gap-3">
                <div className="font-mono text-xs text-muted-foreground w-24 text-right">{item.stage}</div>
                <div className="flex-1 bg-background-tertiary rounded-sm h-6 overflow-hidden">
                  <div
                    className="h-full bg-primary/30 rounded-sm flex items-center px-2"
                    style={{ width: `${(item.count / funnelData[0].count) * 100}%` }}
                  >
                    <span className="font-mono text-[11px] text-primary font-medium">{item.count.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg p-5 border border-border">
          <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {mockActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {activity.type === 'reply_received' && <MessageSquare className="w-3.5 h-3.5 text-success" />}
                  {activity.type === 'email_sent' && <Mail className="w-3.5 h-3.5 text-primary" />}
                  {activity.type === 'cim_uploaded' && <FileText className="w-3.5 h-3.5 text-purple" />}
                  {activity.type === 'dd_memo' && <FileText className="w-3.5 h-3.5 text-cyan" />}
                  {activity.type === 'stage_change' && <ArrowUp className="w-3.5 h-3.5 text-teal" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground">{activity.description}</div>
                  <div className="font-mono text-[10px] text-text-tertiary mt-0.5">
                    {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      <div className="bg-card rounded-lg p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Needs Attention</h2>
          <span className="font-mono text-[10px] text-warning">{needsAttention.length} items</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Business</th>
              <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Industry</th>
              <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Stage</th>
              <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Last Contact</th>
              <th className="text-right font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {needsAttention.map((b) => (
              <tr key={b.id} className="border-b border-border/50 last:border-0">
                <td className="py-3 text-sm text-foreground font-medium">{b.name}</td>
                <td className="py-3 font-mono text-xs text-muted-foreground">{b.naicsLabel} · {b.naicsCode}</td>
                <td className="py-3"><StageBadge stage={b.crmStage!} /></td>
                <td className="py-3 font-mono text-xs text-muted-foreground">
                  {b.lastContactedAt ? new Date(b.lastContactedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </td>
                <td className="py-3 text-right">
                  <button className="text-xs text-primary hover:text-primary/80 font-medium">Follow up →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
