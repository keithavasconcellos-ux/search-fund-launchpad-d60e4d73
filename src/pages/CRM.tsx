import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, LayoutGrid, Table, Clock } from 'lucide-react';
import { updateCrmStage } from '@/lib/queries/businesses';
import { supabase } from '@/integrations/supabase/client';
import { StageBadge } from '@/components/StatusBadge';
import { formatRevenue } from '@/lib/utils';
import { CRM_STAGES, CRM_STAGE_LABELS } from '@/types/acquira';
import type { CrmStage } from '@/types/acquira';

type ViewMode = 'kanban' | 'table' | 'timeline';

// Placeholder user ID until auth is wired
const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000000';

export default function CRM() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const queryClient = useQueryClient();

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['businesses', 'crm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select(`
          *,
          classification:business_classifications(
            vertical, category, business_type, gbp_confidence, sf_score
          )
        `)
        .eq('in_crm', true)
        .order('last_activity_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, from, to }: { id: string; from: CrmStage; to: CrmStage }) =>
      updateCrmStage(id, from, to, PLACEHOLDER_USER_ID),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['businesses'] }),
  });

  const businessesByStage = (stage: CrmStage) =>
    businesses.filter((b) => b.crm_stage === stage);

  // Active stages matching the DB (exclude 'passed' from kanban view)
  const kanbanStages: CrmStage[] = ['identified', 'contacted', 'engaged', 'nda_signed', 'cim_received', 'active_loi'];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground italic">CRM Pipeline</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-background-tertiary rounded-md p-0.5">
            {([['kanban', LayoutGrid], ['table', Table], ['timeline', Clock]] as [ViewMode, any][]).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === mode ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Deal
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' && (
        <div className="flex-1 overflow-x-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading pipeline…</span>
            </div>
          ) : (
            <div className="flex gap-4 min-w-max">
              {kanbanStages.map((stage) => {
                const stageBizs = businessesByStage(stage);
                return (
                  <div key={stage} className="w-[260px] flex-shrink-0">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={stage} />
                        <span className="font-mono text-[11px] text-text-tertiary">{stageBizs.length}</span>
                      </div>
                    </div>
                    <div className="space-y-0">
                      {stageBizs.map((b) => {
                        const cls = Array.isArray(b.classification) ? b.classification[0] : b.classification;
                        return (
                          <div
                            key={b.id}
                            className="bg-background-secondary rounded-lg p-3.5 border border-border hover:border-primary/30 cursor-pointer transition-colors mb-2"
                          >
                            <div className="font-medium text-sm text-foreground mb-1">{b.name}</div>
                            <div className="font-mono text-[11px] text-muted-foreground mb-2">
                              {cls?.business_type ?? '—'} · {b.address ?? '—'}
                            </div>
                            {b.revenue_est_low && b.revenue_est_high && (
                              <div className="font-mono text-[11px] text-text-tertiary">
                                {formatRevenue(b.revenue_est_low)} – {formatRevenue(b.revenue_est_high)}
                              </div>
                            )}
                            {b.deal_confidence_score && (
                              <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 bg-background-tertiary rounded-full h-1">
                                  <div className="bg-primary rounded-full h-1" style={{ width: `${b.deal_confidence_score}%` }} />
                                </div>
                                <span className="font-mono text-[10px] text-text-tertiary">{b.deal_confidence_score}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {stageBizs.length === 0 && (
                        <div className="rounded-lg border border-dashed border-border p-6 text-center">
                          <span className="text-xs text-text-tertiary">No deals</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading pipeline…</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Business', 'Industry', 'Location', 'Stage', 'Revenue Est.', 'Confidence', 'Last Activity'].map((h) => (
                    <th key={h} className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crmBusinesses.filter(b => b.crm_stage && b.crm_stage !== 'passed').map((b) => {
                  const cls = Array.isArray(b.classification) ? b.classification[0] : b.classification;
                  return (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-background-secondary/50 cursor-pointer transition-colors">
                      <td className="py-3 pr-4 text-sm font-medium text-foreground">{b.name}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {cls?.business_type ?? '—'}{cls?.vertical ? ` · ${cls.vertical}` : ''}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{b.address ?? '—'}</td>
                      <td className="py-3 pr-4"><StageBadge stage={b.crm_stage as CrmStage} /></td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {b.revenue_est_low && b.revenue_est_high
                          ? `${formatRevenue(b.revenue_est_low)} – ${formatRevenue(b.revenue_est_high)}`
                          : '—'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{b.deal_confidence_score ?? '—'}</td>
                      <td className="py-3 font-mono text-xs text-muted-foreground">
                        {b.last_activity_at
                          ? new Date(b.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="flex-1 overflow-auto p-6 max-w-3xl">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading timeline…</span>
            </div>
          ) : (
            <div className="space-y-4">
              {crmBusinesses
                .filter(b => b.last_activity_at)
                .sort((a, b) => new Date(b.last_activity_at!).getTime() - new Date(a.last_activity_at!).getTime())
                .map((b) => (
                  <div key={b.id} className="flex gap-4 items-start">
                    <div className="font-mono text-[11px] text-text-tertiary w-16 pt-1 text-right">
                      {new Date(b.last_activity_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="w-px bg-border self-stretch" />
                    <div className="bg-card rounded-lg p-4 border border-border flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{b.name}</span>
                        {b.crm_stage && <StageBadge stage={b.crm_stage as CrmStage} />}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">{b.address ?? '—'}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
