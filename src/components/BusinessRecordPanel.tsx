import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Star, ExternalLink, Plus, Upload, Download, Pencil, Check, Trash2, Building2, RefreshCw, AlertCircle } from 'lucide-react';
import { getBusinessById } from '@/lib/queries/businesses';
import { addToCrm, removeFromCrm } from '@/lib/queries/crm-actions';
import { addNote } from '@/lib/queries/businesses';
import { StageBadge } from '@/components/StatusBadge';
import ReviewStatusDropdown from '@/components/ReviewStatusDropdown';
import { formatRevenue } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CrmStage, ReviewStatus } from '@/types/acquira';
import { fetchSosData, parseCityFromAddress, type SosData } from '@/lib/queries/sos-lookup';

type Tab = 'overview' | 'contacts' | 'notes' | 'docs' | 'cim' | 'sos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'notes', label: 'Notes' },
  { key: 'docs', label: 'Docs' },
  { key: 'cim', label: 'CIM' },
  { key: 'sos', label: 'SOS' },
];

const CONFIDENCE_OPTIONS = ['High', 'Medium', 'Low', 'Unknown'];

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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['business', businessId] });
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
    queryClient.invalidateQueries({ queryKey: ['crm-businesses'] });
  };

  const crmAddMutation = useMutation({
    mutationFn: (id: string) => addToCrm(id),
    onSuccess: invalidateAll,
  });

  const crmRemoveMutation = useMutation({
    mutationFn: (id: string) => removeFromCrm(id),
    onSuccess: invalidateAll,
  });

  if (!businessId) return null;

  const cls = biz
    ? Array.isArray(biz.classification) ? biz.classification[0] : biz.classification
    : null;

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/50" onClick={onClose} />
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
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
                  <X className="w-5 h-5" />
                </button>
              </div>

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

              {/* CRM toggle */}
              <div className="flex items-center gap-2">
                {biz.in_crm ? (
                  <button
                    onClick={() => crmRemoveMutation.mutate(biz.id)}
                    disabled={crmRemoveMutation.isPending}
                    className="flex-1 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                  >
                    {crmRemoveMutation.isPending ? '…' : 'Remove from CRM'}
                  </button>
                ) : (
                  <button
                    onClick={() => crmAddMutation.mutate(biz.id)}
                    disabled={crmAddMutation.isPending}
                    className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    {crmAddMutation.isPending ? '…' : '+ Add to CRM'}
                  </button>
                )}
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
              {activeTab === 'overview' && <OverviewTab biz={biz} cls={cls} onUpdate={invalidateAll} />}
              {activeTab === 'contacts' && <ContactsTab biz={biz} onUpdate={invalidateAll} />}
              {activeTab === 'notes' && <NotesTab biz={biz} onUpdate={invalidateAll} />}
              {activeTab === 'docs' && <DocsTab biz={biz} onUpdate={invalidateAll} />}
              {activeTab === 'cim' && <CimTab biz={biz} onUpdate={invalidateAll} />}
              {activeTab === 'sos' && <SosTab biz={biz} onUpdate={invalidateAll} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ biz, cls, onUpdate }: { biz: any; cls: any; onUpdate: () => void }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="divide-y divide-border">
      <DetailRow label="Address" value={biz.address} />
      <EditableRow label="Phone" field="phone" businessId={biz.id} currentValue={biz.phone} onUpdate={onUpdate} />
      <EditableRow label="Primary Email" field="primary_email" businessId={biz.id} currentValue={(biz as any).primary_email} onUpdate={onUpdate} />
      <DetailRow
        label="Website"
        value={
          biz.website ? (
            <a href={biz.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1">
              {biz.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : null
        }
      />
      <EditableRow label="Est. Revenue" field="revenue_est_low" businessId={biz.id}
        currentValue={biz.revenue_est_low && biz.revenue_est_high ? `${biz.revenue_est_low}-${biz.revenue_est_high}` : ''}
        displayValue={biz.revenue_est_low && biz.revenue_est_high ? `${formatRevenue(biz.revenue_est_low)} – ${formatRevenue(biz.revenue_est_high)}` : null}
        onSave={async (val) => {
          const parts = val.split('-').map(s => parseInt(s.replace(/[^0-9]/g, ''), 10));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const { error } = await supabase.from('businesses').update({ revenue_est_low: parts[0], revenue_est_high: parts[1] } as any).eq('id', biz.id);
            if (error) throw error;
          } else if (parts.length === 1 && !isNaN(parts[0])) {
            const { error } = await supabase.from('businesses').update({ revenue_est_low: parts[0], revenue_est_high: parts[0] } as any).eq('id', biz.id);
            if (error) throw error;
          } else {
            throw new Error('Format: low-high (e.g. 500000-1000000)');
          }
        }}
        onUpdate={onUpdate}
      />
      <EditableRow label="Founded" field="founded_year" businessId={biz.id}
        currentValue={biz.founded_year?.toString() ?? ''}
        displayValue={biz.founded_year ? `~${biz.founded_year} (est. ${currentYear - biz.founded_year}+ yrs)` : null}
        onUpdate={onUpdate}
        onSave={async (val) => {
          const yr = parseInt(val, 10);
          if (isNaN(yr)) throw new Error('Enter a valid year');
          const { error } = await supabase.from('businesses').update({ founded_year: yr } as any).eq('id', biz.id);
          if (error) throw error;
        }}
      />
      <EditableRow label="Employees" field="employee_count" businessId={biz.id}
        currentValue={biz.employee_count?.toString() ?? ''}
        displayValue={biz.employee_count ? `~${biz.employee_count}${biz.employee_count_source ? ` (${biz.employee_count_source})` : ''}` : null}
        onUpdate={onUpdate}
        onSave={async (val) => {
          const n = parseInt(val, 10);
          if (isNaN(n)) throw new Error('Enter a number');
          const { error } = await supabase.from('businesses').update({ employee_count: n } as any).eq('id', biz.id);
          if (error) throw error;
        }}
      />
      <ConfidenceRow businessId={biz.id} currentValue={cls?.gbp_confidence} classificationId={cls?.id} onUpdate={onUpdate} />
      <DetailRow
        label="Rating"
        value={biz.rating != null ? `${biz.rating} (${biz.review_count ?? 0} reviews)` : null}
      />
      <DetailRow
        label="Classification"
        value={cls ? [cls.vertical, cls.category, cls.business_type].filter(Boolean).join(' › ') : null}
      />
      <DetailRow label="Description" value={cls?.business_description} />
      <DetailRow label="Services" value={cls?.services_offered} />
      <DetailRow label="Keywords" value={cls?.industry_keywords} />

      {/* SBA Loan */}
      {(() => {
        const loans = biz.sba_loans ?? [];
        if (loans.length === 0) return <DetailRow label="SBA Loan" value={null} />;
        const loan = loans[0];
        const amt = loan.gross_approval ? `$${Number(loan.gross_approval).toLocaleString()}` : '—';
        const date = loan.approval_date ? new Date(loan.approval_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        return <DetailRow label="SBA Loan" value={`${amt}${date ? ` · ${date}` : ''}`} />;
      })()}
    </div>
  );
}

/* ─── Contacts Tab ─── */
function ContactsTab({ biz, onUpdate }: { biz: any; onUpdate: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from('contacts') as any).insert({
        business_id: biz.id,
        name: form.name.trim(),
        role: form.role.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
      });
      if (error) throw error;
      toast.success('Contact added');
      setForm({ name: '', role: '', email: '', phone: '' });
      setShowForm(false);
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Merge contacts and email threads into contacts tab
  const contacts = biz.contacts ?? [];
  const emailThreads = biz.email_threads ?? [];

  return (
    <div className="p-6 space-y-4">
      {/* Existing contacts */}
      {contacts.length > 0 ? (
        <div className="space-y-3">
          {contacts.map((c: any) => (
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
        !showForm && <EmptyState text="No contacts yet" />
      )}

      {/* Email threads summary */}
      {emailThreads.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Email History</h4>
          <div className="space-y-2">
            {emailThreads.map((e: any) => (
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
        </div>
      )}

      {/* Add contact form */}
      {showForm ? (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h4 className="text-sm font-medium text-foreground">New Contact</h4>
          <input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-md bg-background-tertiary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <input placeholder="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-2 rounded-md bg-background-tertiary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 rounded-md bg-background-tertiary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2 rounded-md bg-background-tertiary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Contact'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors">
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      )}
    </div>
  );
}

/* ─── Notes Tab ─── */
function NotesTab({ biz, onUpdate }: { biz: any; onUpdate: () => void }) {
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addNote(biz.id, noteText.trim(), 'user');
      toast.success('Note added');
      setNoteText('');
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const notes = biz.activities?.filter((a: any) => a.type === 'note') ?? [];

  return (
    <div className="p-6 space-y-4">
      {/* Add note */}
      <div className="space-y-2">
        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full px-3 py-2 rounded-md bg-background-tertiary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        <button onClick={handleSave} disabled={saving || !noteText.trim()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Note'}
        </button>
      </div>

      {/* Existing notes */}
      {notes.length > 0 ? (
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
      )}
    </div>
  );
}

/* ─── Docs Tab ─── */
function DocsTab({ biz, onUpdate }: { biz: any; onUpdate: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storagePath = `${biz.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('dd-documents').upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await (supabase.from('dd_documents') as any).insert({
        business_id: biz.id,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        storage_path: storagePath,
        doc_type: 'general',
        file_size_kb: Math.round(file.size / 1024),
      });
      if (dbError) throw dbError;
      toast.success('Document uploaded');
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage.from('dd-documents').download(doc.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const docs = biz.dd_documents ?? [];

  return (
    <div className="p-6 space-y-4">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50">
        <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload Document'}
      </button>

      {docs.length > 0 ? (
        <div className="space-y-3">
          {docs.map((d: any) => (
            <div key={d.id} className="rounded-lg bg-background-tertiary p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">{d.file_name}</div>
                <div className="text-[11px] font-mono text-text-tertiary">
                  {d.doc_type} · {d.file_size_kb ? `${d.file_size_kb}KB` : ''}
                </div>
              </div>
              <button onClick={() => handleDownload(d)} className="p-1.5 rounded hover:bg-background-secondary text-muted-foreground hover:text-foreground transition-colors">
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No documents yet" />
      )}
    </div>
  );
}

/* ─── CIM Tab ─── */
function CimTab({ biz, onUpdate }: { biz: any; onUpdate: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const storagePath = `cim/${biz.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('dd-documents').upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('dd-documents').getPublicUrl(storagePath);

      const { error: dbError } = await supabase
        .from('businesses')
        .update({
          cim_url: urlData.publicUrl,
          cim_uploaded_at: new Date().toISOString(),
        } as any)
        .eq('id', biz.id);
      if (dbError) throw dbError;
      toast.success('CIM uploaded');
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-6 space-y-4">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.doc,.docx,.xls,.xlsx" />

      {biz.cim_url ? (
        <div className="rounded-lg bg-background-tertiary p-4">
          <div className="text-sm font-medium text-foreground mb-2">CIM Document</div>
          <a href={biz.cim_url} target="_blank" rel="noopener noreferrer"
            className="text-primary text-sm hover:text-primary/80 inline-flex items-center gap-1">
            View CIM <ExternalLink className="w-3 h-3" />
          </a>
          {biz.cim_uploaded_at && (
            <div className="text-[11px] font-mono text-text-tertiary mt-1">
              Uploaded {new Date(biz.cim_uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Replace CIM'}
          </button>
        </div>
      ) : (
        <div className="text-center py-12 space-y-3">
          <span className="font-mono text-xs text-text-tertiary block">No CIM uploaded yet</span>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload CIM'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Editable Row ─── */
function EditableRow({
  label, field, businessId, currentValue, displayValue, onUpdate, onSave,
}: {
  label: string;
  field: string;
  businessId: string;
  currentValue: string | null | undefined;
  displayValue?: React.ReactNode | string | null;
  onUpdate: () => void;
  onSave?: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave(value);
      } else {
        const { error } = await supabase.from('businesses').update({ [field]: value.trim() || null } as any).eq('id', businessId);
        if (error) throw error;
      }
      setEditing(false);
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center px-6 py-2.5 gap-2">
        <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 px-2 py-1 rounded bg-background-tertiary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={handleSave} disabled={saving} className="p-1 text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
        <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-start px-6 py-3.5 group">
      <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground flex-1">{displayValue ?? currentValue ?? '—'}</span>
      <button onClick={() => { setValue(currentValue ?? ''); setEditing(true); }}
        className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── Confidence Dropdown Row ─── */
function ConfidenceRow({ businessId, currentValue, classificationId, onUpdate }: {
  businessId: string; currentValue: string | null; classificationId?: string; onUpdate: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (val: string) => {
    if (!classificationId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('business_classifications').update({ gbp_confidence: val } as any).eq('id', classificationId);
      if (error) throw error;
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center px-6 py-3.5">
      <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">Confidence</span>
      <select
        value={currentValue ?? 'Unknown'}
        onChange={e => handleChange(e.target.value)}
        disabled={saving || !classificationId}
        className="text-sm bg-background-tertiary border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {CONFIDENCE_OPTIONS.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

/* ─── Shared ─── */
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

/* ─── SOS Tab ─── */
function SosTab({ biz, onUpdate }: { biz: any; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const sosData: SosData | null = biz.sos_data ?? null;
  const fetchedAt: string | null = biz.sos_fetched_at ?? null;
  const stateAbbr: string | null = biz.state_abbr ?? null;

  // States supported in Phase 1 (CT direct API)
  const CT_STATES = ['CT'];
  // States that will be supported in Phase 2 (Edge Function)
  const EDGE_STATES = ['MA', 'RI'];
  // States with deep links only (Phase 3)
  const DEEPLINK_STATES = ['NH', 'VT'];

  const isSupported = stateAbbr && [...CT_STATES, ...EDGE_STATES].includes(stateAbbr.toUpperCase());
  const isDeepLinkOnly = stateAbbr && DEEPLINK_STATES.includes(stateAbbr.toUpperCase());
  const isUnknownState = !stateAbbr || (!isSupported && !isDeepLinkOnly);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const city = parseCityFromAddress(biz.address);
      const result = await fetchSosData({
        id: biz.id,
        name: biz.name,
        state_abbr: stateAbbr,
        city,
      });
      if (result) {
        toast.success('SOS data fetched successfully');
        onUpdate();
      } else {
        toast.warning('No matching record found in state registry');
      }
    } catch (e: any) {
      toast.error(`SOS lookup failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const stateLabel = stateAbbr?.toUpperCase() ?? 'Unknown';

  return (
    <div className="p-6 space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Secretary of State Registry</span>
          {stateAbbr && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-primary/15 text-primary">
              {stateLabel}
            </span>
          )}
        </div>
        {fetchedAt && (
          <span className="text-[10px] font-mono text-text-tertiary">
            {new Date(fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>

      {/* State not supported yet */}
      {isUnknownState && (
        <div className="rounded-lg bg-background-tertiary border border-border p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <div className="text-sm text-foreground font-medium mb-0.5">State not detected</div>
            <div className="text-xs text-muted-foreground">
              This business does not have a state code on record. SOS lookup is available for CT, MA, RI, NH, and VT.
            </div>
          </div>
        </div>
      )}

      {/* Phase 3 deep-link states — coming soon notice */}
      {isDeepLinkOnly && (
        <div className="rounded-lg bg-background-tertiary border border-border p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <div className="text-sm text-foreground font-medium mb-0.5">{stateLabel} — Portal link coming soon</div>
            <div className="text-xs text-muted-foreground">
              {stateLabel} uses a JavaScript-rendered portal. Direct lookup support is in Phase 3.
            </div>
          </div>
        </div>
      )}

      {/* MA/RI coming soon notice removed — Phase 2 active */}

      {/* Fetch button — CT (direct API), MA & RI (Edge Function) */}
      {stateAbbr && (CT_STATES.includes(stateAbbr.toUpperCase()) || EDGE_STATES.includes(stateAbbr.toUpperCase())) && (
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading
            ? `Fetching from ${stateLabel} registry…`
            : sosData ? 'Re-fetch SOS Data' : 'Fetch SOS Data'
          }
        </button>
      )}

      {/* Cached data display */}
      {sosData && (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {sosData.matched_name && sosData.matched_name.toUpperCase() !== biz.name.toUpperCase() && (
            <div className="flex items-start px-4 py-2.5 bg-warning/10">
              <span className="w-28 shrink-0 font-mono text-xs text-warning">Matched As</span>
              <span className="text-xs text-warning font-medium">{sosData.matched_name}</span>
            </div>
          )}
          <SosRow label="Entity Type" value={sosData.entity_type} />
          <SosRow label="Status" value={
            sosData.status ? (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                sosData.status.toLowerCase().includes('active')
                  ? 'bg-success/20 text-success'
                  : 'bg-destructive/15 text-destructive'
              }`}>
                {sosData.status}
              </span>
            ) : null
          } />
          <SosRow label="Formed" value={
            sosData.formation_date
              ? new Date(sosData.formation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : null
          } />
          <SosRow label="Reg. Agent" value={sosData.registered_agent} />
          <SosRow label="Address" value={sosData.principal_address} />
          <SosRow label="NAICS" value={sosData.naics_code} />
          {sosData.dba_names.length > 0 && (
            <SosRow label="DBA" value={sosData.dba_names.join(', ')} />
          )}
          {sosData.officers.length > 0 && (
            <div className="px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground block mb-2">Officers</span>
              <div className="space-y-1">
                {sosData.officers.map((o, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-sm text-foreground">{o.name}</span>
                    {o.title && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{o.title}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {sosData.source_url && (
            <div className="px-4 py-3">
              <a
                href={sosData.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View in {sosData.state} Registry <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* No data yet for supported state */}
      {isSupported && !sosData && !loading && (
        <EmptyState text="No SOS data fetched yet — click the button above" />
      )}
    </div>
  );
}

function SosRow({ label, value }: { label: string; value: React.ReactNode | string | null }) {
  return (
    <div className="flex items-start px-4 py-3">
      <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value ?? '—'}</span>
    </div>
  );
}
