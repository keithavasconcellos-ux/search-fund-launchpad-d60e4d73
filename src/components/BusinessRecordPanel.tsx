import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Mail, StickyNote, MoreHorizontal, Star, ExternalLink } from 'lucide-react';
import { getBusinessById } from '@/lib/queries/businesses';
import { addToCrm } from '@/lib/queries/crm-actions';
import { StageBadge } from '@/components/StatusBadge';
import ReviewStatusDropdown from '@/components/ReviewStatusDropdown';
import { formatRevenue } from '@/lib/utils';
import type { CrmStage, ReviewStatus } from '@/types/acquira';

type Tab = 'overview' | 'contacts' | 'emails' | 'notes' | 'docs' | 'cim';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'emails', label: 'Emails' },
  { key: 'notes', label: 'Notes' },
  { key: 'docs', label: 'Docs' },
  { key: 'cim', label: 'CIM' },
];

interface Props {
  businessId: string | null;
  onClose: () => void;
}

export default function BusinessRecordPanel({ businessId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const queryClient = useQueryClient();

  const { data: biz, isLoading } = useQuery({
    queryKey: ['business', businessId],
    queryFn: () => getBusinessById(businessId!),
    enabled: !!businessId,
  });

  const crmMutation = useMutation({
    mutationFn: (id: string) => addToCrm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
  });

  if (!businessId) return null;

  const cls = biz
    ? Array.isArray(biz.classification) ? biz.classification[0] : biz.classification
    : null;

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9998] bg-black/50" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 bottom-0 z-[9999] w-full max-w-md bg-background-secondary border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-xs text-text-tertiary animate-pulse">Loading…</span>
          </div>
        ) : !biz ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="font-mono text-xs text-text-tertiary">Not found</span>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-start justify-between mb-3">
                <h2 className="font-display text-xl text-foreground italic leading-tight pr-4">
                  {biz.name}
                </h2>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Badges row */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {cls?.business_type && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono font-medium bg-primary/20 text-primary">
                    {cls.business_type}
                    {cls.sf_score != null && ` · ${cls.sf_score}`}
                  </span>
                )}
                {biz.crm_stage && <StageBadge stage={biz.crm_stage as CrmStage} />}
                <ReviewStatusDropdown businessId={biz.id} currentStatus={biz.review_status as ReviewStatus} compact />
                {biz.rating != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-warning/20 text-warning">
                    <Star className="w-3 h-3" />
                    {biz.rating}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background-tertiary transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                  Send Email
                </button>
                <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-background-tertiary transition-colors">
                  <StickyNote className="w-3.5 h-3.5" />
                  Add Note
                </button>
                {!biz.in_crm ? (
                  <button
                    onClick={() => crmMutation.mutate(biz.id)}
                    disabled={crmMutation.isPending}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    {crmMutation.isPending ? '…' : '+ CRM'}
                  </button>
                ) : (
                  <span className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    ✓ In CRM
                  </span>
                )}
                <button className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-background-tertiary transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab bar */}
            <div className="px-6 border-b border-border">
              <div className="flex gap-6">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'overview' && (
                <div className="divide-y divide-border">
                  <DetailRow label="Address" value={biz.address} />
                  <DetailRow label="Phone" value={biz.phone} />
                  <DetailRow
                    label="Website"
                    value={
                      biz.website ? (
                        <a
                          href={biz.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                        >
                          {biz.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null
                    }
                  />
                  <DetailRow
                    label="Est. Revenue"
                    value={
                      biz.revenue_est_low && biz.revenue_est_high
                        ? `${formatRevenue(biz.revenue_est_low)} – ${formatRevenue(biz.revenue_est_high)}`
                        : null
                    }
                  />
                  <DetailRow
                    label="Founded"
                    value={
                      biz.founded_year
                        ? `~${biz.founded_year} (est. ${currentYear - biz.founded_year}+ yrs)`
                        : null
                    }
                  />
                  <DetailRow
                    label="Employees"
                    value={
                      biz.employee_count
                        ? `~${biz.employee_count}${biz.employee_count_source ? ` (${biz.employee_count_source})` : ''}`
                        : null
                    }
                  />
                  {/* Owner from contacts */}
                  {(() => {
                    const owner = biz.contacts?.find((c: any) => c.is_owner);
                    return owner ? (
                      <DetailRow label="Owner" value={`${owner.name}${owner.role ? ` (${owner.role})` : ''}`} />
                    ) : null;
                  })()}
                  <DetailRow
                    label="Rating"
                    value={
                      biz.rating != null
                        ? `${biz.rating} (${biz.review_count ?? 0} reviews)`
                        : null
                    }
                  />
                  <DetailRow
                    label="Classification"
                    value={
                      cls
                        ? [cls.vertical, cls.category, cls.business_type].filter(Boolean).join(' › ')
                        : null
                    }
                  />
                  <DetailRow
                    label="Confidence"
                    value={cls?.gbp_confidence ?? null}
                  />
                </div>
              )}

              {activeTab === 'contacts' && (
                <div className="p-6">
                  {biz.contacts && biz.contacts.length > 0 ? (
                    <div className="space-y-3">
                      {biz.contacts.map((c: any) => (
                        <div key={c.id} className="rounded-lg bg-background-tertiary p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground">{c.name}</span>
                            {c.is_owner && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary">Owner</span>
                            )}
                          </div>
                          {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
                          {c.email && <div className="text-xs text-muted-foreground mt-1">{c.email}</div>}
                          {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No contacts yet" />
                  )}
                </div>
              )}

              {activeTab === 'emails' && (
                <div className="p-6">
                  {biz.email_threads && biz.email_threads.length > 0 ? (
                    <div className="space-y-3">
                      {biz.email_threads.map((e: any) => (
                        <div key={e.id} className="rounded-lg bg-background-tertiary p-3">
                          <div className="text-sm font-medium text-foreground mb-1">{e.subject}</div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              e.status === 'replied' ? 'bg-success/20 text-success' :
                              e.status === 'opened' ? 'bg-warning/20 text-warning' :
                              e.status === 'sent' ? 'bg-primary/20 text-primary' :
                              'bg-muted text-muted-foreground'
                            }`}>{e.status}</span>
                            {e.sent_at && (
                              <span className="text-[11px] font-mono text-text-tertiary">
                                {new Date(e.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No emails yet" />
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="p-6">
                  {(() => {
                    const notes = biz.activities?.filter((a: any) => a.type === 'note') ?? [];
                    return notes.length > 0 ? (
                      <div className="space-y-3">
                        {notes.map((n: any) => (
                          <div key={n.id} className="rounded-lg bg-background-tertiary p-3">
                            <div className="text-sm text-foreground whitespace-pre-wrap">{n.body}</div>
                            <div className="text-[11px] font-mono text-text-tertiary mt-2">
                              {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="No notes yet" />
                    );
                  })()}
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="p-6">
                  {biz.dd_documents && biz.dd_documents.length > 0 ? (
                    <div className="space-y-3">
                      {biz.dd_documents.map((d: any) => (
                        <div key={d.id} className="rounded-lg bg-background-tertiary p-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-foreground">{d.file_name}</div>
                            <div className="text-[11px] font-mono text-text-tertiary">
                              {d.doc_type} · {d.file_size_kb ? `${d.file_size_kb}KB` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="No documents yet" />
                  )}
                </div>
              )}

              {activeTab === 'cim' && (
                <div className="p-6">
                  {biz.cim_url ? (
                    <div className="rounded-lg bg-background-tertiary p-4">
                      <div className="text-sm font-medium text-foreground mb-2">CIM Document</div>
                      <a
                        href={biz.cim_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm hover:text-primary/80 inline-flex items-center gap-1"
                      >
                        View CIM <ExternalLink className="w-3 h-3" />
                      </a>
                      {biz.cim_uploaded_at && (
                        <div className="text-[11px] font-mono text-text-tertiary mt-1">
                          Uploaded {new Date(biz.cim_uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <EmptyState text="No CIM uploaded yet" />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode | string | null }) {
  return (
    <div className="flex items-start px-6 py-3.5">
      <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12">
      <span className="font-mono text-xs text-text-tertiary">{text}</span>
    </div>
  );
}
