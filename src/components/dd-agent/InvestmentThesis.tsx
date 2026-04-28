import type { MemoSections } from '@/lib/queries/dd-agent';

export function InvestmentThesis({
  sections,
  paragraph,
  confidence,
}: {
  sections: MemoSections;
  paragraph: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
}) {
  const it = sections.investment_thesis ?? { thesis: '', bull_case: [], bear_case: [], next_steps: [] };
  const thesis = it.thesis || paragraph || '';
  const confColor =
    confidence === 'high'   ? 'bg-success/20 text-success border-success/30' :
    confidence === 'medium' ? 'bg-warning/20 text-warning border-warning/30' :
    'bg-destructive/20 text-destructive border-destructive/30';

  return (
    <div id="memo-section-8" className="scroll-mt-6 bg-card rounded-lg p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded">S8</span>
          <h3 className="text-sm font-medium text-foreground">Investment Thesis</h3>
        </div>
        {confidence && (
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${confColor}`}>
            Confidence: {confidence}
          </span>
        )}
      </div>

      {thesis && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic border-l-2 border-primary/40 pl-3">
          {thesis}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <div className="bg-success/5 border border-success/20 rounded-md p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-success mb-2">Bull case</div>
          <ul className="space-y-1.5">
            {it.bull_case.length === 0 && (
              <li className="text-xs text-text-tertiary italic">None generated.</li>
            )}
            {it.bull_case.map((b, i) => (
              <li key={i} className="text-sm text-foreground leading-snug pl-3 relative">
                <span className="absolute left-0 text-success">·</span>{b}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-destructive mb-2">Bear case</div>
          <ul className="space-y-1.5">
            {it.bear_case.length === 0 && (
              <li className="text-xs text-text-tertiary italic">None generated.</li>
            )}
            {it.bear_case.map((b, i) => (
              <li key={i} className="text-sm text-foreground leading-snug pl-3 relative">
                <span className="absolute left-0 text-destructive">·</span>{b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {it.next_steps.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-2">
            Recommended next steps
          </div>
          <ol className="space-y-1.5">
            {it.next_steps.map((s, i) => (
              <li key={i} className="text-sm text-muted-foreground leading-snug flex gap-2">
                <span className="font-mono text-text-tertiary w-4">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
