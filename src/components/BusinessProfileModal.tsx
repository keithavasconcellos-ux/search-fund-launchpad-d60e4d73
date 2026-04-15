import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, MapPin, Phone, Globe, Star } from 'lucide-react';
import { getBusinessById } from '@/lib/queries/businesses';
import { StageBadge, ReviewBadge } from '@/components/StatusBadge';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

interface Props {
  businessId: string | null;
  onClose: () => void;
}

export default function BusinessProfileModal({ businessId, onClose }: Props) {
  const { data: biz, isLoading } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => getBusinessById(businessId!),
    enabled: !!businessId,
  });

  if (!businessId) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-background-secondary border border-border rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-display text-foreground truncate">
            {isLoading ? 'Loading…' : biz?.name ?? 'Business Profile'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : biz ? (
          <div className="p-5 space-y-4">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <ReviewBadge status={biz.review_status as ReviewStatus} />
              <StageBadge stage={biz.crm_stage as CrmStage} />
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              {biz.address && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{biz.address}</span>
                </div>
              )}
              {biz.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{biz.phone}</span>
                </div>
              )}
              {biz.website && (
                <a href={biz.website} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors">
                  <Globe className="w-4 h-4 shrink-0" />
                  <span className="truncate">{biz.website}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
              {biz.rating != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="w-4 h-4 shrink-0 text-warning" />
                  <span>{biz.rating} ({biz.review_count ?? 0} reviews)</span>
                </div>
              )}
            </div>

            {/* Classification */}
            {(() => {
              const cls = Array.isArray(biz.classification) ? biz.classification[0] : biz.classification;
              if (!cls) return null;
              return (
                <>
                  <div className="rounded-lg bg-background-tertiary p-3 space-y-1">
                    <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">Classification</div>
                    {(cls as any).vertical && (
                      <div className="text-sm text-foreground">
                        {(cls as any).vertical}
                        {(cls as any).category && <span className="text-muted-foreground"> › {(cls as any).category}</span>}
                      </div>
                    )}
                    {(cls as any).business_type && (
                      <div className="text-sm text-foreground">{(cls as any).business_type}</div>
                    )}
                  </div>
                  {(cls as any).business_description && (
                    <div className="rounded-lg bg-background-tertiary p-3 space-y-1">
                      <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">Description</div>
                      <div className="text-sm text-foreground">{(cls as any).business_description}</div>
                    </div>
                  )}
                  {(cls as any).services_offered && (
                    <div className="rounded-lg bg-background-tertiary p-3 space-y-1">
                      <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">Services Offered</div>
                      <div className="text-sm text-foreground">{(cls as any).services_offered}</div>
                    </div>
                  )}
                  {(cls as any).industry_keywords && (
                    <div className="rounded-lg bg-background-tertiary p-3 space-y-1">
                      <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">Industry Keywords</div>
                      <div className="text-sm text-foreground">{(cls as any).industry_keywords}</div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* SBA Loan */}
            {(() => {
              const loans = (biz as any).sba_loans ?? [];
              if (loans.length === 0) return null;
              const loan = loans[0];
              const amt = loan.gross_approval ? `$${Number(loan.gross_approval).toLocaleString()}` : '—';
              const date = loan.approval_date ? new Date(loan.approval_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
              return (
                <div className="rounded-lg bg-background-tertiary p-3 space-y-1">
                  <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">SBA Loan</div>
                  <div className="text-sm text-foreground font-mono">{amt}{date ? ` · ${date}` : ''}</div>
                </div>
              );
            })()}

            {/* Revenue */}
            {(biz.revenue_est_low || biz.revenue_est_high) && (
              <div className="rounded-lg bg-background-tertiary p-3 space-y-1">
                <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-widest">Revenue Est.</div>
                <div className="text-sm text-foreground font-mono">
                  ${((biz.revenue_est_low ?? 0) / 1e6).toFixed(1)}M – ${((biz.revenue_est_high ?? 0) / 1e6).toFixed(1)}M
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">Not found</div>
        )}
      </div>
    </div>
  );
}
