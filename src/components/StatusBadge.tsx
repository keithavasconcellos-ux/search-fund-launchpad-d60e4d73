import { CRM_STAGE_LABELS } from '@/types/acquira';
import type { CrmStage, ReviewStatus, GbpConfidence } from '@/types/acquira';

const stageColors: Record<CrmStage, string> = {
  identified:   'bg-muted text-muted-foreground',
  contacted:    'bg-primary/20 text-primary',
  engaged:      'bg-teal-500/20 text-teal-400',
  nda_signed:   'bg-purple-500/20 text-purple-400',
  cim_received: 'bg-cyan-500/20 text-cyan-400',
  active_loi:   'bg-success/20 text-success',
  passed:       'bg-muted text-text-tertiary',
};

export function StageBadge({ stage }: { stage: CrmStage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${stageColors[stage] ?? 'bg-muted text-muted-foreground'}`}>
      {CRM_STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const cls =
    status === 'target'     ? 'bg-success/20 text-success' :
    status === 'pass'       ? 'bg-destructive/20 text-destructive' :
    status === 'watch'      ? 'bg-warning/20 text-warning' :
    'bg-muted text-muted-foreground';

  const label =
    status === 'target'     ? 'Target' :
    status === 'pass'       ? 'Pass' :
    status === 'watch'      ? 'Watch' :
    'Unreviewed';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function ConfidenceDot({ confidence }: { confidence: GbpConfidence | null }) {
  const cls =
    confidence === 'High'   ? 'bg-success' :
    confidence === 'Medium' ? 'bg-warning' :
    'bg-destructive';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}
