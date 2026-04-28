import { CRM_STAGE_LABELS } from '@/types/acquira';
import type { CrmStage, ReviewStatus, GbpConfidence } from '@/types/acquira';

// Per-stage colour system (Step 6 of design spec).
// Dark tinted bg + matching border + matching text. Not a solid fill.
const stageStyles: Record<CrmStage, { bg: string; text: string; border: string }> = {
  identified:   { bg: '#1a2a3e', text: '#5a8aaa', border: '#1e3a5a' },
  contacted:    { bg: '#1a2a1a', text: '#5aaa5a', border: '#1e5a1e' },
  engaged:      { bg: '#1a1a2a', text: '#7a7afa', border: '#3a3a8a' },
  nda_signed:   { bg: '#2a2a0a', text: '#aaaa2a', border: '#5a5a0a' },
  cim_received: { bg: '#2a1a0a', text: '#f5a623', border: '#5a3a0a' },
  active_loi:   { bg: '#1a0a0a', text: '#f04e6a', border: '#5a1a1a' },
  passed:       { bg: '#1a1a1a', text: '#4a5a6a', border: '#2a3a4a' },
};

const badgeBase =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] font-mono text-[9px] font-medium uppercase tracking-[0.5px] border';

export function StageBadge({ stage }: { stage: CrmStage }) {
  const s = stageStyles[stage] ?? stageStyles.identified;
  return (
    <span
      className={badgeBase}
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {CRM_STAGE_LABELS[stage] ?? stage}
    </span>
  );
}

const reviewStyles: Record<ReviewStatus | 'unreviewed', { bg: string; text: string; border: string; label: string }> = {
  target:     { bg: '#0d2a20', text: '#34d399', border: '#1a5a3a', label: 'Target' },
  pass:       { bg: '#1a0a0a', text: '#f04e6a', border: '#5a1a1a', label: 'Pass' },
  watch:      { bg: '#2a1a0a', text: '#f5a623', border: '#5a3a0a', label: 'Watch' },
  unreviewed: { bg: '#1a1a1a', text: '#4a5a6a', border: '#2a3a4a', label: 'Unreviewed' },
};

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const s = reviewStyles[status] ?? reviewStyles.unreviewed;
  return (
    <span
      className={badgeBase}
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {s.label}
    </span>
  );
}

// Email response classification badges
const responseStyles = {
  positive:       { bg: '#0d2a20', text: '#34d399', border: '#1a5a3a' },
  negative:       { bg: '#1a0a0a', text: '#f04e6a', border: '#5a1a1a' },
  neutral:        { bg: '#1a1a20', text: '#6b7a8a', border: '#2a3a4a' },
  out_of_office:  { bg: '#1a1a1a', text: '#4a5a6a', border: '#2a3a4a' },
} as const;

export type ResponseClassification = keyof typeof responseStyles;

export function ResponseBadge({ classification, label }: { classification: ResponseClassification; label?: string }) {
  const s = responseStyles[classification];
  const text = label ?? classification.replace(/_/g, ' ');
  return (
    <span
      className={badgeBase}
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {text}
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
