import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { updateReviewStatus } from '@/lib/queries/review-status';
import type { ReviewStatus } from '@/types/acquira';

const OPTIONS: { value: ReviewStatus; label: string; dot: string }[] = [
  { value: 'target', label: 'Target', dot: 'bg-success' },
  { value: 'watch', label: 'Watch', dot: 'bg-warning' },
  { value: 'pass', label: 'Pass', dot: 'bg-destructive' },
  { value: 'unreviewed', label: 'Unreviewed', dot: 'bg-muted-foreground' },
];

interface Props {
  businessId: string;
  currentStatus: ReviewStatus;
  /** Compact mode for map popups / table rows */
  compact?: boolean;
  /** Called after successful update with new status */
  onUpdated?: (newStatus: ReviewStatus) => void;
}

export default function ReviewStatusDropdown({
  businessId,
  currentStatus,
  compact = false,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (status: ReviewStatus) => updateReviewStatus(businessId, status),
    onSuccess: (_data, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      onUpdated?.(newStatus);
    },
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = OPTIONS.find((o) => o.value === currentStatus) ?? OPTIONS[3];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1.5 rounded font-mono font-medium transition-colors ${
          compact
            ? 'px-2 py-0.5 text-[11px] bg-background-tertiary hover:bg-background-quaternary text-muted-foreground'
            : 'px-2.5 py-1 text-xs border border-border hover:bg-background-tertiary text-foreground'
        }`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${current.dot}`} />
        {current.label}
        <ChevronDown className={`shrink-0 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-text-tertiary`} />
      </button>

      {open && (
        <div className="absolute z-[10000] mt-1 left-0 w-36 rounded-lg bg-card border border-border shadow-lg py-1">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={(e) => {
                e.stopPropagation();
                if (opt.value !== currentStatus) mutation.mutate(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors hover:bg-background-tertiary ${
                opt.value === currentStatus ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
              {opt.label}
              {opt.value === currentStatus && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
