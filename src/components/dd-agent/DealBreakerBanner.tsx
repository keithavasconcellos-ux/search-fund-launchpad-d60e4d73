import { AlertTriangle } from 'lucide-react';

export function DealBreakerBanner({ flags }: { flags: string[] }) {
  return (
    <div className="bg-destructive/10 border border-destructive/40 border-l-4 border-l-destructive rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider text-destructive mb-1">
            Deal Breaker
          </div>
          <div className="text-sm font-medium text-destructive-foreground/90 mb-2">
            Deal Breaker Condition Detected
          </div>
          {flags.length > 0 ? (
            <ul className="space-y-1">
              {flags.map((f, i) => (
                <li key={i} className="text-sm text-destructive-foreground/80 leading-snug">
                  · {f}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-destructive-foreground/80">Review required.</div>
          )}
        </div>
      </div>
    </div>
  );
}
