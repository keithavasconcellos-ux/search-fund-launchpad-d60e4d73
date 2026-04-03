import { useState } from 'react';
import { Plus, LayoutGrid, Table, Clock } from 'lucide-react';
import { mockBusinesses, pipelineStages, formatRevenue, type CrmStage, type Business } from '@/lib/mockData';
import { StageBadge } from '@/components/StatusBadge';

type ViewMode = 'kanban' | 'table' | 'timeline';

function KanbanCard({ business }: { business: Business }) {
  return (
    <div className="bg-background-secondary rounded-lg p-3.5 border border-border hover:border-primary/30 cursor-pointer transition-colors mb-2">
      <div className="font-medium text-sm text-foreground mb-1">{business.name}</div>
      <div className="font-mono text-[11px] text-muted-foreground mb-2">
        {business.naicsLabel} · {business.city}, {business.state}
      </div>
      {business.revenueEstLow && business.revenueEstHigh && (
        <div className="font-mono text-[11px] text-text-tertiary">
          {formatRevenue(business.revenueEstLow)} – {formatRevenue(business.revenueEstHigh)}
        </div>
      )}
      {business.dealConfidenceScore && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-background-tertiary rounded-full h-1">
            <div className="bg-primary rounded-full h-1" style={{ width: `${business.dealConfidenceScore}%` }} />
          </div>
          <span className="font-mono text-[10px] text-text-tertiary">{business.dealConfidenceScore}</span>
        </div>
      )}
    </div>
  );
}

export default function CRM() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const activeStages: CrmStage[] = ['Identified', 'Contacted', 'Engaged', 'NDA Signed', 'CIM Received', 'IOI Submitted', 'LOI Active', 'Under LOI'];

  const businessesByStage = (stage: CrmStage) =>
    mockBusinesses.filter((b) => b.crmStage === stage);

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
          <div className="flex gap-4 min-w-max">
            {activeStages.map((stage) => {
              const businesses = businessesByStage(stage);
              return (
                <div key={stage} className="w-[260px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <StageBadge stage={stage} />
                      <span className="font-mono text-[11px] text-text-tertiary">{businesses.length}</span>
                    </div>
                  </div>
                  <div className="space-y-0">
                    {businesses.map((b) => (
                      <KanbanCard key={b.id} business={b} />
                    ))}
                    {businesses.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center">
                        <span className="text-xs text-text-tertiary">No deals</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 overflow-auto p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Business', 'Industry', 'Location', 'Stage', 'Revenue Est.', 'Confidence', 'Last Contact'].map((h) => (
                  <th key={h} className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockBusinesses.filter(b => b.crmStage).map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-background-secondary/50 cursor-pointer transition-colors">
                  <td className="py-3 pr-4 text-sm font-medium text-foreground">{b.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{b.naicsLabel} · {b.naicsCode}</td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{b.city}, {b.state}</td>
                  <td className="py-3 pr-4"><StageBadge stage={b.crmStage!} /></td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                    {b.revenueEstLow && b.revenueEstHigh ? `${formatRevenue(b.revenueEstLow)} – ${formatRevenue(b.revenueEstHigh)}` : '—'}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{b.dealConfidenceScore ?? '—'}</td>
                  <td className="py-3 font-mono text-xs text-muted-foreground">
                    {b.lastContactedAt ? new Date(b.lastContactedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="flex-1 overflow-auto p-6 max-w-3xl">
          <div className="space-y-4">
            {mockBusinesses.filter(b => b.lastContactedAt).sort((a, b) => new Date(b.lastContactedAt!).getTime() - new Date(a.lastContactedAt!).getTime()).map((b) => (
              <div key={b.id} className="flex gap-4 items-start">
                <div className="font-mono text-[11px] text-text-tertiary w-16 pt-1 text-right">
                  {new Date(b.lastContactedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="w-px bg-border self-stretch" />
                <div className="bg-card rounded-lg p-4 border border-border flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{b.name}</span>
                    {b.crmStage && <StageBadge stage={b.crmStage} />}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{b.naicsLabel} · {b.city}, {b.state}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
