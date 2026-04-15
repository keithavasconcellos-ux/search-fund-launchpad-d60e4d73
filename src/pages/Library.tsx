import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, LayoutGrid, Table, Download, SlidersHorizontal, X, RotateCcw, ChevronDown } from 'lucide-react';
import { getBusinesses, getClassificationTaxonomy, type TaxonomyTree } from '@/lib/queries/businesses';
import { supabase } from '@/integrations/supabase/client';
import { StageBadge, ConfidenceDot } from '@/components/StatusBadge';
import ReviewStatusDropdown from '@/components/ReviewStatusDropdown';
import { formatRevenue } from '@/lib/utils';
import BusinessRecordPanel from '@/components/BusinessRecordPanel';
import type { CrmStage, ReviewStatus, GbpConfidence } from '@/types/acquira';

type ViewMode = 'table' | 'cards';

const REVIEW_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'target', label: 'Target' },
  { value: 'watch', label: 'Watch' },
  { value: 'pass', label: 'Pass' },
  { value: 'unreviewed', label: 'Unreviewed' },
] as const;

const NE_STATES = ['CT', 'MA', 'RI', 'NH', 'VT', 'ME', 'NY', 'NJ'];

const PIN_COLORS: Record<string, string> = {
  target: '#22d3a7',
  watch: '#f59e0b',
  pass: '#ef4444',
  unreviewed: '#6b8aff',
};

/* ── Reusable Cascading Select ── */
function CascadingSelect({ label, value, options, onChange, disabled, placeholder }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
  disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full appearance-none rounded-md border px-2.5 py-1.5 pr-7 text-xs font-mono transition-colors outline-none cursor-pointer
          ${disabled
            ? 'border-border/40 bg-background-tertiary/30 text-text-tertiary/40 cursor-not-allowed'
            : value
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-border bg-background-tertiary text-muted-foreground hover:border-primary/30 hover:text-foreground'
          }`}
      >
        <option value="">{placeholder ?? `All ${label}s`}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${disabled ? 'text-text-tertiary/30' : 'text-text-tertiary'}`} />
    </div>
  );
}

export default function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters (matching map view)
  const [filterReview, setFilterReview] = useState<ReviewStatus | ''>('');
  const [filterState, setFilterState] = useState<string>('');
  const [filterCounty, setFilterCounty] = useState<string>('');
  const [filterVertical, setFilterVertical] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBusinessType, setFilterBusinessType] = useState<string>('');
  const [filterInCrm, setFilterInCrm] = useState<'' | 'yes' | 'no'>('');

  const activeFilterCount = [filterReview, filterState, filterCounty, filterVertical, filterCategory, filterBusinessType, filterInCrm].filter(Boolean).length;

  // Taxonomy for drill-down
  const { data: taxonomy = {} } = useQuery({
    queryKey: ['classification-taxonomy'],
    queryFn: getClassificationTaxonomy,
    staleTime: 1000 * 60 * 60,
  });

  // Counties
  const { data: counties = [] } = useQuery({
    queryKey: ['distinct-counties', filterState],
    queryFn: async () => {
      let query = supabase.from('businesses').select('county').not('county', 'is', null).order('county').limit(5000);
      if (filterState) query = query.eq('state_abbr', filterState);
      const { data, error } = await query;
      if (error) throw error;
      return [...new Set((data ?? []).map(r => r.county).filter(Boolean))].sort() as string[];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Business data — apply filters via post-filter since getBusinesses supports limited server filters
  const { data: businesses = [], isLoading, error } = useQuery({
    queryKey: ['businesses', searchQuery, filterReview, filterVertical, filterCategory, filterBusinessType, filterState, filterCounty, filterInCrm],
    queryFn: () => getBusinesses({
      search: searchQuery || undefined,
      review_status: (filterReview as ReviewStatus) || undefined,
      vertical: filterVertical || undefined,
      category: filterCategory || undefined,
      business_type: filterBusinessType || undefined,
      state_abbr: filterState || undefined,
      county: filterCounty || undefined,
      in_crm: filterInCrm === 'yes' ? true : filterInCrm === 'no' ? false : undefined,
      limit: 500,
    }),
  });

  const filtered = businesses;

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-destructive font-mono text-sm">Failed to load businesses.</p>
      </div>
    );
  }

  // Taxonomy drill-down data
  const verticals = Object.keys(taxonomy).filter(v => v !== 'Out of Scope').sort();
  const categories = filterVertical ? Object.keys(taxonomy[filterVertical] ?? {}).sort() : [];
  const catData = filterVertical && filterCategory ? taxonomy[filterVertical]?.[filterCategory] : undefined;
  const businessTypes = catData ? (Array.isArray(catData) ? catData as string[] : Object.keys(catData).sort()) : [];

  const hasIndustryFilter = !!(filterVertical || filterCategory || filterBusinessType);

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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-background-tertiary text-muted-foreground hover:bg-background-quaternary'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <span className="font-mono text-[11px] text-text-tertiary">
            {isLoading ? 'Loading…' : `${filtered.length} results`}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Filter Sidebar ── */}
        {showFilters && (
          <div className="w-[260px] flex-shrink-0 bg-background-secondary border-r border-border flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground font-mono text-[9px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button onClick={() => setShowFilters(false)} className="text-text-tertiary hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Industry Drill-Down */}
              <div className="border-b border-border pb-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">Industry</label>
                  {hasIndustryFilter && (
                    <button
                      onClick={() => { setFilterVertical(''); setFilterCategory(''); setFilterBusinessType(''); }}
                      className="flex items-center gap-1 font-mono text-[10px] text-primary hover:text-primary/80 transition-colors"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />Reset
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <CascadingSelect label="Vertical" value={filterVertical} options={verticals}
                    onChange={v => { setFilterVertical(v); setFilterCategory(''); setFilterBusinessType(''); }}
                    placeholder="All Verticals" />
                  <div className="ml-3 pl-3 border-l border-border/50">
                    <CascadingSelect label="Category" value={filterCategory} options={categories}
                      onChange={c => { setFilterCategory(c); setFilterBusinessType(''); }}
                      disabled={!filterVertical}
                      placeholder={filterVertical ? 'All Categories' : 'Select Vertical first'} />
                  </div>
                  <div className="ml-6 pl-3 border-l border-border/50">
                    <CascadingSelect label="Business Type" value={filterBusinessType} options={businessTypes}
                      onChange={bt => setFilterBusinessType(bt)}
                      disabled={!filterCategory}
                      placeholder={filterCategory ? 'All Types' : 'Select Category first'} />
                  </div>
                </div>
                {hasIndustryFilter && (
                  <div className="mt-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-[10px] font-mono text-primary/80 leading-relaxed">
                    {[filterVertical, filterCategory, filterBusinessType].filter(Boolean).join(' › ')}
                  </div>
                )}
              </div>

              {/* Review Status */}
              <div className="border-b border-border pb-5">
                <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Review Status</label>
                <div className="space-y-0.5">
                  {REVIEW_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterReview(opt.value as ReviewStatus | '')}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                        filterReview === opt.value
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                      }`}
                    >
                      {opt.value && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIN_COLORS[opt.value] ?? '#888' }} />
                      )}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* In CRM */}
              <div className="border-b border-border pb-5">
                <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">In CRM</label>
                <div className="space-y-0.5">
                  {[{ value: '', label: 'All' }, { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterInCrm(opt.value as '' | 'yes' | 'no')}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all ${
                        filterInCrm === opt.value
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background-tertiary'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Geography */}
              <div>
                <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-3">Geography</label>
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setFilterState(''); setFilterCounty(''); }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${!filterState ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                    >All</button>
                    {NE_STATES.map(s => (
                      <button key={s}
                        onClick={() => { setFilterState(filterState === s ? '' : s); setFilterCounty(''); }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${filterState === s ? 'bg-primary text-primary-foreground' : 'bg-background-tertiary text-muted-foreground hover:text-foreground'}`}
                      >{s}</button>
                    ))}
                  </div>
                </div>
                <div className="ml-3 pl-3 border-l border-border/50">
                  <CascadingSelect label="County" value={filterCounty} options={counties}
                    onChange={setFilterCounty} disabled={!filterState}
                    placeholder={filterState ? 'All Counties' : 'Select State first'} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'table' && (
            <div className="px-8 py-4">
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
                    {filtered.map((b: any) => {
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
                            <ReviewStatusDropdown businessId={b.id} currentStatus={b.review_status as ReviewStatus} compact />
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
                          No businesses found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {viewMode === 'cards' && (
            <div className="px-8 py-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading businesses…</span>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {filtered.map((b: any) => {
                    const cls = Array.isArray(b.classification) ? b.classification[0] : b.classification;
                    return (
                      <div key={b.id} className="bg-card rounded-lg p-4 border border-border hover:border-primary/30 cursor-pointer transition-colors" onClick={() => setSelectedBusinessId(b.id)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">{b.name}</span>
                          <ReviewStatusDropdown businessId={b.id} currentStatus={b.review_status as ReviewStatus} compact />
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
      </div>

      <BusinessRecordPanel
        businessId={selectedBusinessId}
        onClose={() => setSelectedBusinessId(null)}
      />
    </div>
  );
}
