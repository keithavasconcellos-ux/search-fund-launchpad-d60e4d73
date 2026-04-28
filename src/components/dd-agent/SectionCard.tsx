import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { MemoSection } from '@/lib/queries/dd-agent';

const statusDot: Record<string, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-destructive',
  not_disclosed: 'bg-text-tertiary/50',
};
const statusLabel: Record<string, string> = {
  green: 'Strong',
  yellow: 'Caveat',
  red: 'Concern',
  not_disclosed: 'Not disclosed',
};

export function SectionCard({
  num,
  title,
  section,
  source,
  trailing,
  onAddQuestion,
  children,
}: {
  num: number;
  title: string;
  section: MemoSection;
  source?: string;
  trailing?: React.ReactNode;
  onAddQuestion?: (q: string) => void;
  children?: React.ReactNode;
}) {
  const [ndOpen, setNdOpen] = useState(false);
  return (
    <div id={`memo-section-${num}`} className="scroll-mt-6 bg-card rounded-lg p-5 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded">
            S{num}
          </span>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {trailing}
        </div>
        {source && (
          <span className="font-mono text-[10px] text-text-tertiary">{source}</span>
        )}
      </div>

      {section.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{section.summary}</p>
      )}

      {section.criteria.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden mb-3">
          {section.criteria.map((c, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1.4fr_auto] items-start gap-3 px-3 py-2 text-sm border-b border-border last:border-b-0 bg-background-secondary"
            >
              <div className="text-foreground">{c.label}</div>
              <div className={`${c.value ? 'text-muted-foreground' : 'text-text-tertiary italic'}`}>
                {c.value ?? 'Not disclosed'}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDot[c.status]}`} />
                <span className="font-mono text-[9px] uppercase tracking-wider text-text-tertiary">
                  {statusLabel[c.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {section.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {section.flags.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-warning/15 text-warning border border-warning/30 rounded-full px-2.5 py-0.5 text-[11px]"
            >
              ⚠ {f}
            </span>
          ))}
        </div>
      )}

      {section.not_disclosed.length > 0 && (
        <div>
          <button
            onClick={() => setNdOpen((o) => !o)}
            className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-text-tertiary hover:text-muted-foreground"
          >
            {ndOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {section.not_disclosed.length} items not disclosed
          </button>
          {ndOpen && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {section.not_disclosed.map((nd, i) => (
                <button
                  key={i}
                  onClick={() => onAddQuestion?.(nd)}
                  className="group inline-flex items-center gap-1 bg-background-tertiary text-text-tertiary border border-border rounded-full px-2.5 py-0.5 text-[11px] hover:text-foreground hover:border-primary/40"
                  title="Add to open questions"
                >
                  {nd}
                  <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
