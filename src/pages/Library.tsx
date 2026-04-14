import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, LayoutGrid, Table, Download } from 'lucide-react';
import { getBusinesses } from '@/lib/queries/businesses';
import { StageBadge, ReviewBadge, ConfidenceDot } from '@/components/StatusBadge';
import { formatRevenue } from '@/lib/utils';
import BusinessRecordPanel from '@/components/BusinessRecordPanel';
import type { CrmStage, ReviewStatus, GbpConfidence } from '@/types/acquira';

type ViewMode = 'table' | 'cards';

export default function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  const { data: businesses = [], isLoading, error } = useQuery({
    queryKey: ['businesses', searchQuery],
    queryFn: () => getBusinesses({ search: searchQuery || undefined, limit: 200 }),
  });

  const filtered = businesses;

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-destructive font-mono text-sm">Failed to load businesses. Check your Supabase connection.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl text-foreground italic">Business Library</h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-background-tertiary rounded-md p-0.5">
              {([['table', Table], ['cards', LayoutGrid]] as [ViewMode, any][]).map(([mode, Icon]) => (
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
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background-tertiary text-muted-foreground text-sm hover:bg-background-quaternary transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-background-tertiary rounded-md px-3 py-2 flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search businesses, cities, industries…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-text-tertiary outline-none w-full"
            />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-background-tertiary text-muted-foreground text-sm hover:bg-background-quaternary transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
          <span className="font-mono text-[11px] text-text-tertiary">
            {isLoading ? 'Loading…' : `${filtered.length} results`}
          </span>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 overflow-auto px-8 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading businesses…</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Business', 'Classification', 'Address', 'Review Status', 'Est. Revenue', 'CRM Stage'].map((h) => (
                    <th key={h} className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const cls = Array.isArray(b.classification) ? b.classification[0] : b.classification;
                  return (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-background-secondary/50 cursor-pointer transition-colors" onClick={() => setSelectedBusinessId(b.id)}>
                      <td className="py-3 pr-4">
                        <div className="text-sm font-medium text-foreground">{b.name}</div>
                        <div className="font-mono text-[10px] text-text-tertiary">{b.phone}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <ConfidenceDot confidence={(cls?.gbp_confidence ?? 'Low') as GbpConfidence} />
                          <span className="font-mono text-xs text-muted-foreground">
                            {cls?.business_type ?? '—'}{cls?.vertical ? ` · ${cls.vertical}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{b.address ?? '—'}</td>
                      <td className="py-3 pr-4">
                        <ReviewBadge status={b.review_status as ReviewStatus} />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {b.revenue_est_low && b.revenue_est_high
                          ? `${formatRevenue(b.revenue_est_low)} – ${formatRevenue(b.revenue_est_high)}`
                          : '—'}
                      </td>
                      <td className="py-3">
                        {b.crm_stage ? <StageBadge stage={b.crm_stage as CrmStage} /> : <span className="text-xs text-text-tertiary">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center font-mono text-xs text-text-tertiary">
                      No businesses found. Add some data via the Supabase dashboard or an import.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="flex-1 overflow-auto px-8 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading businesses…</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((b) => {
                const cls = Array.isArray(b.classification) ? b.classification[0] : b.classification;
                return (
                  <div key={b.id} className="bg-card rounded-lg p-4 border border-border hover:border-primary/30 cursor-pointer transition-colors" onClick={() => setSelectedBusinessId(b.id)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{b.name}</span>
                      <ReviewBadge status={b.review_status as ReviewStatus} />
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground mb-1">
                      {cls?.business_type ?? '—'}{cls?.vertical ? ` · ${cls.vertical}` : ''}
                    </div>
                    <div className="text-xs text-text-tertiary mb-3">{b.address ?? '—'}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        {b.revenue_est_low && b.revenue_est_high
                          ? `${formatRevenue(b.revenue_est_low)} – ${formatRevenue(b.revenue_est_high)}`
                          : '—'}
                      </span>
                      {b.crm_stage && <StageBadge stage={b.crm_stage as CrmStage} />}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <div className="col-span-3 py-12 text-center font-mono text-xs text-text-tertiary">
                  No businesses found.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
