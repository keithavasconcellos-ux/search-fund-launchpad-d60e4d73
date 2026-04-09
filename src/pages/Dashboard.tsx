import { useQuery } from '@tanstack/react-query';
import { ArrowUp, Mail, MessageSquare, FileText, RefreshCw } from 'lucide-react';
import { getDashboardKpis, getPipelineFunnelCounts, getNeedsAttention } from '@/lib/queries/dashboard';
import { StageBadge } from '@/components/StatusBadge';
import { CRM_STAGE_LABELS } from '@/types/acquira';
import type { CrmStage } from '@/types/acquira';

const FUNNEL_STAGES: CrmStage[] = ['identified', 'contacted', 'engaged', 'nda_signed', 'cim_received', 'active_loi'];

export default function Dashboard() {
  const { data: kpis, isLoading: kpisLoading, refetch } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => getDashboardKpis(7),
    refetchInterval: 60_000,
  });

  const { data: funnelCounts = {}, isLoading: funnelLoading } = useQuery({
    queryKey: ['pipeline-funnel'],
    queryFn: getPipelineFunnelCounts,
    refetchInterval: 60_000,
  });

  const { data: needsAttention = [], isLoading: attentionLoading } = useQuery({
    queryKey: ['needs-attention'],
    queryFn: getNeedsAttention,
    refetchInterval: 60_000,
  });

  const maxFunnelCount = FUNNEL_STAGES.reduce((max, s) => Math.max(max, funnelCounts[s] ?? 0), 1);

  const kpiCards = kpis
    ? [
        { label: 'Businesses Tracked', value: kpis.total_businesses.toLocaleString() },
        { label: 'Emails Sent (7d)', value: kpis.emails_sent.toLocaleString() },
        { label: 'Reply Rate (7d)', value: `${(kpis.reply_rate * 100).toFixed(1)}%` },
        { label: 'Positive Rate (7d)', value: `${(kpis.positive_rate * 100).toFixed(1)}%` },
      ]
    : [];

  return (
    <div className="p-8 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-foreground italic">Dashboard</h1>
          <p className="font-mono text-xs text-text-tertiary mt-1 uppercase tracking-wider">
            Last refreshed: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-tertiary text-muted-foreground text-sm hover:bg-background-quaternary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpisLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-lg p-5 border border-border animate-pulse h-24" />
            ))
          : kpiCards.map((kpi) => (
              <div key={kpi.label} className="bg-card rounded-lg p-5 border border-border">
                <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-2">{kpi.label}</div>
                <div className="text-2xl font-semibold text-foreground font-mono">{kpi.value}</div>
              </div>
            ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Pipeline Funnel */}
        <div className="bg-card rounded-lg p-5 border border-border">
          <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Pipeline Funnel</h2>
          {funnelLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 bg-background-tertiary rounded-sm animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {FUNNEL_STAGES.map((stage) => {
                const count = funnelCounts[stage] ?? 0;
                return (
                  <div key={stage} className="flex items-center gap-3">
                    <div className="font-mono text-xs text-muted-foreground w-28 text-right">
                      {CRM_STAGE_LABELS[stage]}
                    </div>
                    <div className="flex-1 bg-background-tertiary rounded-sm h-6 overflow-hidden">
                      <div
                        className="h-full bg-primary/30 rounded-sm flex items-center px-2"
                        style={{ width: `${(count / maxFunnelCount) * 100}%` }}
                      >
                        <span className="font-mono text-[11px] text-primary font-medium">{count.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg p-5 border border-border">
          <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Recent Activity</h2>
          {kpisLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-background-tertiary rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {kpis?.recent_activity.length === 0 && (
                <p className="text-xs text-text-tertiary font-mono">No recent activity.</p>
              )}
              {kpis?.recent_activity.map((activity: any) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {activity.type === 'email_replied' && <MessageSquare className="w-3.5 h-3.5 text-success" />}
                    {activity.type === 'email_sent' && <Mail className="w-3.5 h-3.5 text-primary" />}
                    {activity.type === 'cim_uploaded' && <FileText className="w-3.5 h-3.5 text-purple-400" />}
                    {activity.type === 'memo_generated' && <FileText className="w-3.5 h-3.5 text-cyan-400" />}
                    {activity.type === 'stage_change' && <ArrowUp className="w-3.5 h-3.5 text-teal-400" />}
                    {activity.type === 'note' && <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground">
                      {(activity as any).businesses?.name && (
                        <span className="font-medium">{(activity as any).businesses.name} — </span>
                      )}
                      {activity.body ?? activity.type.replace(/_/g, ' ')}
                    </div>
                    <div className="font-mono text-[10px] text-text-tertiary mt-0.5">
                      {new Date(activity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Needs Attention */}
      <div className="bg-card rounded-lg p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Needs Attention</h2>
          <span className="font-mono text-[10px] text-warning">{needsAttention.length} items</span>
        </div>
        {attentionLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-background-tertiary rounded animate-pulse" />
            ))}
          </div>
        ) : needsAttention.length === 0 ? (
          <p className="text-xs text-text-tertiary font-mono py-4 text-center">No deals need attention right now.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Business</th>
                <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Industry</th>
                <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Stage</th>
                <th className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Last Activity</th>
                <th className="text-right font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {needsAttention.map((b) => {
                const cls = Array.isArray(b.classification) ? b.classification[0] : b.classification;
                return (
                  <tr key={b.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 text-sm text-foreground font-medium">{b.name}</td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">{cls?.business_type ?? '—'}</td>
                    <td className="py-3"><StageBadge stage={b.crm_stage as CrmStage} /></td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {b.last_activity_at
                        ? new Date(b.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <button className="text-xs text-primary hover:text-primary/80 font-medium">Follow up →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
