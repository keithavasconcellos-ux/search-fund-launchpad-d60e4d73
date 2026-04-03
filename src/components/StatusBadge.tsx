import { type CrmStage, type ReviewStatus, getStageColor } from '@/lib/mockData';

export function StageBadge({ stage }: { stage: CrmStage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${getStageColor(stage)}`}>
      {stage}
    </span>
  );
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const cls = status === 'Target' ? 'bg-success/20 text-success' :
              status === 'Non-Target' ? 'bg-destructive/20 text-destructive' :
              'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function ConfidenceDot({ confidence }: { confidence: 'High' | 'Medium' | 'Low' | null }) {
  const cls = confidence === 'High' ? 'bg-success' : confidence === 'Medium' ? 'bg-warning' : 'bg-destructive';
  return <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />;
}
