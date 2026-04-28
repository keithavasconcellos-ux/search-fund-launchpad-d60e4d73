import type { Risk } from '@/lib/queries/dd-agent';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { DealBreakerBanner } from './DealBreakerBanner';

const sevOrder: Record<Risk['severity'], number> = { high: 0, medium: 1, low: 2 };
const sevColors: Record<Risk['severity'], string> = {
  high:   'bg-destructive/20 text-destructive border-destructive/40',
  medium: 'bg-warning/20 text-warning border-warning/40',
  low:    'bg-background-tertiary text-text-tertiary border-border',
};

export function RiskRegister({
  risks,
  dealBreakerFired,
  flags,
  conditionsEvaluated,
}: {
  risks: Risk[];
  dealBreakerFired: boolean;
  flags: string[];
  conditionsEvaluated: number;
}) {
  const sorted = [...risks].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
  return (
    <div id="memo-section-7" className="scroll-mt-6 bg-card rounded-lg p-5 border border-border">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded">S7</span>
        <h3 className="text-sm font-medium text-foreground">Risk Register</h3>
      </div>

      {dealBreakerFired ? (
        <div className="mb-4">
          <DealBreakerBanner flags={flags} />
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5 bg-success/15 text-success border border-success/30 rounded-full px-3 py-1 text-[11px] mb-4">
          <CheckCircle className="w-3 h-3" />
          No deal breaker conditions found — {conditionsEvaluated} conditions evaluated
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-text-tertiary italic">No risks identified.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r, i) => (
            <div key={i} className="border border-border rounded-md p-3 bg-background-secondary">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-sm font-medium text-foreground">{r.label}</span>
                </div>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${sevColors[r.severity]}`}>
                  {r.severity}
                </span>
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed mb-1">{r.description}</div>
              <div className="text-xs text-text-tertiary leading-relaxed">
                <span className="font-mono uppercase tracking-wider mr-1.5">Mitigant:</span>
                {r.mitigant}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
