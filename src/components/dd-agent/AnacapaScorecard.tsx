import type { Quadrant } from '@/lib/queries/dd-agent';

const colorMap: Record<string, { bg: string; text: string; label: string }> = {
  green:  { bg: 'bg-success/20',     text: 'text-success',     label: 'Strong' },
  yellow: { bg: 'bg-warning/20',     text: 'text-warning',     label: 'Caveats' },
  red:    { bg: 'bg-destructive/20', text: 'text-destructive', label: 'Concern' },
};

const QUADRANT_LABELS: Record<string, string> = {
  quadrant_1: 'Business Quality',
  quadrant_2: 'Financial Profile',
  quadrant_3: 'Management',
  quadrant_4: 'Deal Structure',
};

export function AnacapaScorecard({
  scorecard,
}: {
  scorecard: {
    quadrant_1: Quadrant;
    quadrant_2: Quadrant;
    quadrant_3: Quadrant;
    quadrant_4: Quadrant;
    descriptors?: Record<string, string>;
  };
}) {
  return (
    <div className="bg-background-secondary rounded-lg p-5 border border-border">
      <h3 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">
        Anacapa Fit Scorecard
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {(['quadrant_1', 'quadrant_2', 'quadrant_3', 'quadrant_4'] as const).map((q) => {
          const score = scorecard[q];
          const desc = scorecard.descriptors?.[q] ?? '';
          if (!score) {
            return (
              <div key={q} className="bg-background-tertiary rounded-lg p-3 border border-border">
                <div className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary mb-1">
                  {QUADRANT_LABELS[q]}
                </div>
                <div className="text-sm text-text-tertiary italic">Insufficient data</div>
              </div>
            );
          }
          const c = colorMap[score];
          return (
            <div key={q} className={`${c.bg} rounded-lg p-3`}>
              <div className={`font-mono text-[10px] uppercase tracking-wider ${c.text} mb-1`}>
                {QUADRANT_LABELS[q]} · {c.label}
              </div>
              <div className="text-sm text-foreground leading-snug">
                {desc || c.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScorecardDots({
  scorecard,
  size = 'sm',
}: {
  scorecard: {
    quadrant_1: Quadrant;
    quadrant_2: Quadrant;
    quadrant_3: Quadrant;
    quadrant_4: Quadrant;
  };
  size?: 'sm' | 'md';
}) {
  const dotCls = size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  const dot = (q: Quadrant) =>
    !q ? 'bg-text-tertiary/40' :
    q === 'green'  ? 'bg-success' :
    q === 'yellow' ? 'bg-warning' :
    'bg-destructive';
  return (
    <div className="grid grid-cols-2 gap-1 w-fit">
      <span className={`${dotCls} rounded-full ${dot(scorecard.quadrant_1)}`} />
      <span className={`${dotCls} rounded-full ${dot(scorecard.quadrant_2)}`} />
      <span className={`${dotCls} rounded-full ${dot(scorecard.quadrant_3)}`} />
      <span className={`${dotCls} rounded-full ${dot(scorecard.quadrant_4)}`} />
    </div>
  );
}
