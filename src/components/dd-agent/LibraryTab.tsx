import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, ExternalLink, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { StageBadge } from '@/components/StatusBadge';
import { ScorecardDots, AnacapaScorecard } from './AnacapaScorecard';
import { getAllMemos, deleteMemo, type DDMemo } from '@/lib/queries/dd-agent';
import type { CrmStage } from '@/types/acquira';

type LibMemo = DDMemo & { business: { name: string; crm_stage: string | null; vertical: string | null } };

export function LibraryTab({ onOpenMemo, onSwitchToUpload }: {
  onOpenMemo: (m: DDMemo) => void;
  onSwitchToUpload: () => void;
}) {
  const [memos, setMemos] = useState<LibMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<string>('all');
  const [vertical, setVertical] = useState<string>('all');
  const [scorecardFilter, setScorecardFilter] = useState<'all' | 'concern' | 'clear'>('all');
  const [sort, setSort] = useState<'date' | 'name' | 'red'>('date');

  const reload = () => {
    setLoading(true);
    getAllMemos().then((m) => { setMemos(m as LibMemo[]); setLoading(false); }).catch((e) => { toast.error(e.message); setLoading(false); });
  };
  useEffect(reload, []);

  const verticals = useMemo(() => Array.from(new Set(memos.map((m) => m.business.vertical).filter(Boolean))) as string[], [memos]);

  const filtered = useMemo(() => {
    let list = memos;
    if (search) list = list.filter((m) => m.business.name.toLowerCase().includes(search.toLowerCase()));
    if (stage !== 'all') list = list.filter((m) => m.business.crm_stage === stage);
    if (vertical !== 'all') list = list.filter((m) => m.business.vertical === vertical);
    if (scorecardFilter !== 'all') {
      list = list.filter((m) => {
        const sc = m.sections.anacapa_fit_scorecard;
        const reds = [sc.quadrant_1, sc.quadrant_2, sc.quadrant_3, sc.quadrant_4].filter((q) => q === 'red').length;
        const all = [sc.quadrant_1, sc.quadrant_2, sc.quadrant_3, sc.quadrant_4];
        if (scorecardFilter === 'concern') return reds >= 1;
        return all.every((q) => q === 'green');
      });
    }
    list = [...list];
    if (sort === 'date') list.sort((a, b) => +new Date(b.generated_at) - +new Date(a.generated_at));
    if (sort === 'name') list.sort((a, b) => a.business.name.localeCompare(b.business.name));
    if (sort === 'red') list.sort((a, b) => Number(b.deal_breaker_fired) - Number(a.deal_breaker_fired));
    return list;
  }, [memos, search, stage, vertical, scorecardFilter, sort]);

  const selected = filtered.find((m) => m.id === selectedId) ?? null;

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading memos…</div>;

  if (memos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <div className="font-display text-3xl italic text-foreground mb-3">No analyses yet</div>
        <p className="text-muted-foreground mb-6">Upload a CIM to generate your first memo.</p>
        <button onClick={onSwitchToUpload} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          Go to Upload CIM
        </button>
      </div>
    );
  }

  const completeness = (m: LibMemo) => {
    const all = ['business_overview', 'financial_profile', 'management_team', 'customer_analysis', 'operations', 'market_position'] as const;
    let total = 0, ok = 0;
    for (const k of all) {
      const sec: any = (m.sections as any)[k];
      total += (sec?.criteria?.length ?? 0) + (sec?.not_disclosed?.length ?? 0);
      ok += sec?.criteria?.length ?? 0;
    }
    return total > 0 ? Math.round((ok / total) * 100) : 0;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="border-b border-border p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business name…"
            className="w-full pl-8 pr-3 py-1.5 bg-background-tertiary border border-border rounded-md text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="bg-background-tertiary border border-border rounded-md text-sm py-1.5 px-2">
          <option value="all">All stages</option>
          {['identified', 'contacted', 'engaged', 'nda_signed', 'cim_received', 'active_loi', 'passed'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={vertical} onChange={(e) => setVertical(e.target.value)} className="bg-background-tertiary border border-border rounded-md text-sm py-1.5 px-2">
          <option value="all">All verticals</option>
          {verticals.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={scorecardFilter} onChange={(e) => setScorecardFilter(e.target.value as any)} className="bg-background-tertiary border border-border rounded-md text-sm py-1.5 px-2">
          <option value="all">All scorecards</option>
          <option value="concern">Any concern</option>
          <option value="clear">All clear</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-background-tertiary border border-border rounded-md text-sm py-1.5 px-2">
          <option value="date">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="red">Deal breakers first</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Card list */}
        <div className="w-[380px] flex-shrink-0 border-r border-border overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center mt-8">No memos match these filters.</p>
          ) : filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left p-3 rounded-md border transition-colors ${
                selectedId === m.id ? 'border-primary bg-primary/5' : 'border-border bg-background-secondary hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-foreground truncate">{m.business.name}</span>
                {m.deal_breaker_fired && (
                  <span className="text-[9px] font-mono uppercase bg-destructive/20 text-destructive border border-destructive/40 rounded px-1.5 py-0.5 flex-shrink-0">
                    Deal Breaker
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-[10px] text-text-tertiary">v{m.version} · {new Date(m.generated_at).toLocaleDateString()}</span>
                {m.business.crm_stage && <StageBadge stage={m.business.crm_stage as CrmStage} />}
              </div>
              <div className="flex items-center justify-between gap-2">
                <ScorecardDots scorecard={m.sections.anacapa_fit_scorecard} />
                <div className="flex-1 ml-3">
                  <div className="h-1 bg-background-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${completeness(m)}%` }} />
                  </div>
                  <div className="text-[10px] font-mono text-text-tertiary mt-0.5 text-right">{completeness(m)}% extracted</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-tertiary italic text-sm">
              Select a memo to preview
            </div>
          ) : (
            <PreviewPane memo={selected} onOpen={() => onOpenMemo(selected)} onDeleted={() => { setSelectedId(null); reload(); }} />
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewPane({ memo, onOpen, onDeleted }: { memo: LibMemo; onOpen: () => void; onDeleted: () => void }) {
  const it = memo.sections.investment_thesis;
  const highRisks = (memo.sections.risk_register ?? []).filter((r) => r.severity === 'high');

  const handleDelete = async () => {
    if (!confirm(`Delete memo for ${memo.business.name}?`)) return;
    try { await deleteMemo(memo.id); toast.success('Memo deleted'); onDeleted(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="font-display text-2xl italic text-foreground">{memo.business.name}</h2>
        <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mt-1">
          {memo.analysis_label ?? 'Initial DD'} · v{memo.version} · {new Date(memo.generated_at).toLocaleDateString()}
        </div>
      </div>

      {memo.deal_breaker_fired && (
        <div className="bg-destructive/10 border border-destructive/40 border-l-4 border-l-destructive rounded-md p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-destructive mb-1">Deal Breaker</div>
          <ul className="text-sm text-destructive-foreground/80 space-y-0.5">
            {memo.sections.deal_breaker_check.flags.map((f, i) => <li key={i}>· {f}</li>)}
          </ul>
        </div>
      )}

      <AnacapaScorecard scorecard={memo.sections.anacapa_fit_scorecard} />

      {it && (
        <div className="bg-card rounded-lg p-5 border border-border">
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">Investment Thesis</div>
          {it.thesis && <p className="text-sm text-muted-foreground italic mb-3 leading-relaxed">{it.thesis}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-mono uppercase text-success mb-1">Bull</div>
              <ul className="space-y-1 text-xs text-foreground">
                {it.bull_case.map((b, i) => <li key={i}>· {b}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-destructive mb-1">Bear</div>
              <ul className="space-y-1 text-xs text-foreground">
                {it.bear_case.map((b, i) => <li key={i}>· {b}</li>)}
              </ul>
            </div>
          </div>
          {it.next_steps.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-mono uppercase text-text-tertiary mb-1">Next steps</div>
              <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                {it.next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}
        </div>
      )}

      {highRisks.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-destructive mb-2">High-severity risks</div>
          <div className="flex flex-wrap gap-2">
            {highRisks.map((r, i) => (
              <span key={i} className="bg-destructive/15 text-destructive border border-destructive/30 rounded-full px-3 py-1 text-xs">
                {r.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onOpen} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          <ExternalLink className="w-3.5 h-3.5" /> Open Full Memo
        </button>
        <button onClick={() => toast.info('PDF export coming soon')} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-background-tertiary text-foreground text-sm hover:bg-background-quaternary">
          <FileDown className="w-3.5 h-3.5" /> Export PDF
        </button>
        <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-destructive/15 text-destructive text-sm hover:bg-destructive/25 ml-auto">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
