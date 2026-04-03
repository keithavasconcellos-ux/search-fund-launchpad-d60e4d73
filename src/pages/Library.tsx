import { useState } from 'react';
import { Search, SlidersHorizontal, LayoutGrid, Table, Download } from 'lucide-react';
import { mockBusinesses, formatRevenue } from '@/lib/mockData';
import { StageBadge, ReviewBadge, ConfidenceDot } from '@/components/StatusBadge';

type ViewMode = 'table' | 'cards';

export default function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = mockBusinesses.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.naicsLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <span className="font-mono text-[11px] text-text-tertiary">{filtered.length} results</span>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="flex-1 overflow-auto px-8 py-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Business', 'NAICS / Industry', 'Location', 'Distance', 'Review Status', 'Est. Revenue', 'CRM Stage'].map((h) => (
                  <th key={h} className="text-left font-mono text-[10px] text-text-tertiary uppercase tracking-wider pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-background-secondary/50 cursor-pointer transition-colors">
                  <td className="py-3 pr-4">
                    <div className="text-sm font-medium text-foreground">{b.name}</div>
                    <div className="font-mono text-[10px] text-text-tertiary">{b.phone}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <ConfidenceDot confidence={b.naicsConfidence === 'Needs Review' ? 'Low' : b.naicsConfidence} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {b.naicsConfidence === 'Medium' && '~'}{b.naicsLabel} · {b.naicsCode}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">{b.city}, {b.state}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{b.distanceMi} mi</td>
                  <td className="py-3 pr-4"><ReviewBadge status={b.reviewStatus} /></td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                    {b.revenueEstLow && b.revenueEstHigh ? `${formatRevenue(b.revenueEstLow)} – ${formatRevenue(b.revenueEstHigh)}` : '—'}
                  </td>
                  <td className="py-3">{b.crmStage ? <StageBadge stage={b.crmStage} /> : <span className="text-xs text-text-tertiary">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="flex-1 overflow-auto px-8 py-4">
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((b) => (
              <div key={b.id} className="bg-card rounded-lg p-4 border border-border hover:border-primary/30 cursor-pointer transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{b.name}</span>
                  <ReviewBadge status={b.reviewStatus} />
                </div>
                <div className="font-mono text-[11px] text-muted-foreground mb-1">
                  {b.naicsLabel} · {b.naicsCode}
                </div>
                <div className="text-xs text-text-tertiary mb-3">{b.city}, {b.state} · {b.distanceMi} mi</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    {b.revenueEstLow && b.revenueEstHigh ? `${formatRevenue(b.revenueEstLow)} – ${formatRevenue(b.revenueEstHigh)}` : '—'}
                  </span>
                  {b.crmStage && <StageBadge stage={b.crmStage} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
