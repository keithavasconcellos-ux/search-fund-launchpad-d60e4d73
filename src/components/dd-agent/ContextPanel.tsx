import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StageBadge } from '@/components/StatusBadge';
import { ExternalLink, RefreshCw, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { DDMemo } from '@/lib/queries/dd-agent';

export function ContextPanel({
  memo,
  versions,
  questions,
  onRemoveQuestion,
  onLoadVersion,
  onRegenerate,
}: {
  memo: DDMemo;
  versions: DDMemo[];
  questions: { text: string; section: number }[];
  onRemoveQuestion: (i: number) => void;
  onLoadVersion: (m: DDMemo) => void;
  onRegenerate: () => void;
}) {
  const [biz, setBiz] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    supabase
      .from('businesses')
      .select('id, name, crm_stage, rating, review_count, revenue_est_low, revenue_est_high, sba_loan_approved, last_activity_at')
      .eq('id', memo.business_id)
      .maybeSingle()
      .then(({ data }) => { if (!cancel) setBiz(data); });
    return () => { cancel = true; };
  }, [memo.business_id]);

  const fmtMoney = (n: number | null) => n ? `$${(n / 1_000_000).toFixed(1)}M` : '—';

  const copyAll = () => {
    const text = questions.map((q, i) => `${i + 1}. [S${q.section}] ${q.text}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Questions copied to clipboard');
  };

  return (
    <aside className="w-[300px] flex-shrink-0 border-l border-border overflow-y-auto p-4 space-y-4">
      {/* CRM snapshot */}
      <Section title="CRM Snapshot">
        {biz ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground font-medium truncate">{biz.name}</span>
              {biz.crm_stage && <StageBadge stage={biz.crm_stage} />}
            </div>
            <Row label="Google rating" value={biz.rating ? `${biz.rating} (${biz.review_count ?? 0})` : '—'} />
            <Row label="Revenue est." value={`${fmtMoney(biz.revenue_est_low)} – ${fmtMoney(biz.revenue_est_high)}`} />
            {biz.sba_loan_approved && (
              <span className="inline-block text-[10px] font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded px-2 py-0.5">
                SBA Loan
              </span>
            )}
            <Row label="Last activity" value={biz.last_activity_at ? new Date(biz.last_activity_at).toLocaleDateString() : '—'} />
            <button
              onClick={() => navigate(`/crm?business=${biz.id}`)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-background-tertiary text-foreground text-xs hover:bg-background-quaternary transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> View in CRM
            </button>
          </div>
        ) : <Skeleton />}
      </Section>

      {/* Memo metadata */}
      <Section title="Memo Metadata">
        <div className="space-y-1.5">
          <Row label="Generated" value={new Date(memo.generated_at).toLocaleString()} />
          <Row label="Model" value={memo.model_used} />
          <Row label="Input" value={memo.input_type ?? '—'} />
          {memo.input_page_count != null && <Row label="Pages" value={String(memo.input_page_count)} />}
          <Row label="Label" value={memo.analysis_label ?? '—'} />
          <Row label="Version" value={`v${memo.version}`} />
          <button
            onClick={() => {
              if (confirm('Regenerate this memo? This will create a new version.')) onRegenerate();
            }}
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/15 text-primary text-xs hover:bg-primary/25 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
        </div>
      </Section>

      {/* Open questions */}
      <Section
        title="Open Questions"
        right={
          questions.length > 0 ? (
            <button onClick={copyAll} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary hover:text-primary/80">
              <Copy className="w-3 h-3" /> Copy all
            </button>
          ) : null
        }
      >
        {questions.length === 0 ? (
          <p className="text-xs text-text-tertiary italic">No open questions yet. Click "Add to questions" on any not-disclosed item.</p>
        ) : (
          <ol className="space-y-1.5">
            {questions.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-text-tertiary w-4 flex-shrink-0">{i + 1}.</span>
                <span className="font-mono text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded flex-shrink-0">S{q.section}</span>
                <span className="text-muted-foreground flex-1 leading-snug">{q.text}</span>
                <button
                  onClick={() => onRemoveQuestion(i)}
                  className="text-text-tertiary hover:text-destructive flex-shrink-0"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Version history */}
      {versions.length > 1 && (
        <Section title="Version History">
          <div className="space-y-1.5">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => onLoadVersion(v)}
                className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between gap-2 ${
                  v.id === memo.id ? 'bg-primary/15 text-primary' : 'hover:bg-background-tertiary text-muted-foreground'
                }`}
              >
                <span>v{v.version} · {new Date(v.generated_at).toLocaleDateString()}</span>
                {v.deal_breaker_fired && (
                  <span className="text-[9px] font-mono uppercase text-destructive">DB</span>
                )}
              </button>
            ))}
          </div>
        </Section>
      )}
    </aside>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-text-tertiary">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-foreground font-mono text-right truncate">{value}</span>
    </div>
  );
}
function Skeleton() {
  return <div className="h-16 bg-background-tertiary animate-pulse rounded" />;
}
