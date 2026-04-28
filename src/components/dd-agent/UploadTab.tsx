import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCrmBusinessesForLinking,
  getMemosForBusiness,
  generateMemo,
  extractCimBusiness,
  type DDMemo,
} from '@/lib/queries/dd-agent';
import { ScorecardDots } from './AnacapaScorecard';

type Mode = 'cim' | 'call_notes' | 'name_only' | 'new_from_cim';

export function UploadTab({ onMemoCreated, onOpenMemo }: {
  onMemoCreated: (memo: DDMemo) => void;
  onOpenMemo: (memo: DDMemo) => void;
}) {
  const [mode, setMode] = useState<Mode>('cim');
  const [businesses, setBusinesses] = useState<{ id: string; name: string; address: string | null; vertical: string | null }[]>([]);
  const [businessId, setBusinessId] = useState<string>('');
  const [analysisLabel, setAnalysisLabel] = useState('Initial DD');
  const [additionalContext, setAdditionalContext] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState('');
  const [notes, setNotes] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState<string>('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [priorMemos, setPriorMemos] = useState<DDMemo[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    getCrmBusinessesForLinking()
      .then(setBusinesses)
      .catch((e) => toast.error(`Failed to load CRM: ${e.message}`));
  }, []);

  useEffect(() => {
    if (!businessId) { setPriorMemos([]); return; }
    getMemosForBusiness(businessId).then(setPriorMemos).catch(() => setPriorMemos([]));
  }, [businessId]);

  const selectedBiz = businesses.find((b) => b.id === businessId);

  const handleFile = async (f: File) => {
    if (f.size > 50 * 1024 * 1024) {
      toast.error('File exceeds 50MB limit'); return;
    }
    setFile(f);
    // Simple text extraction: read PDFs as text won't work natively, so we send filename + best-effort text.
    // For .txt/.md/.docx (best-effort) we'll just read as text. Real PDF parsing happens in the AI's interpretation
    // when CIM is uploaded — for now, surface what we can.
    try {
      const text = await f.text();
      setFileText(text.replace(/\u0000/g, ' ').slice(0, 200_000));
    } catch {
      setFileText('');
    }
  };

  const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
  const canGenerate =
    !generating &&
    ((mode === 'new_from_cim' && !!file && !!newBusinessName.trim()) ||
      (!!businessId &&
        (mode === 'name_only' ||
          (mode === 'cim' && !!file) ||
          (mode === 'call_notes' && wordCount >= 50))));

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      let targetBusinessId = businessId;
      let cimText = fileText;

      if (mode === 'new_from_cim' && file) {
        setGeneratingStage('Reading CIM and creating business…');
        const result = await extractCimBusiness({ name: newBusinessName.trim(), file });
        targetBusinessId = result.business.id;
        cimText = result.cim_text_dump || fileText;
        toast.success(`Added "${result.business.name}" to CRM`);
        // Refresh CRM caches
        queryClient.invalidateQueries({ queryKey: ['businesses'] });
        queryClient.invalidateQueries({ queryKey: ['crm-businesses'] });
      }

      setGeneratingStage('Generating DD memo…');
      const memo = await generateMemo({
        business_id: targetBusinessId,
        input_type: mode === 'new_from_cim' ? 'cim' : mode,
        input_text:
          mode === 'cim' || mode === 'new_from_cim'
            ? `[Filename: ${file?.name}]\n\n${cimText}`
            : mode === 'call_notes'
            ? notes
            : undefined,
        analysis_label: analysisLabel || 'Initial DD',
        additional_context: additionalContext || undefined,
        page_count: undefined,
      });
      toast.success('Memo generated');
      onMemoCreated(memo);
    } catch (e: any) {
      toast.error(e.message ?? 'Generation failed');
    } finally {
      setGenerating(false);
      setGeneratingStage('');
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Mode toggle */}
      <div className="grid grid-cols-4 bg-background-tertiary rounded-md p-1 mb-6 gap-0.5">
        {([
          { v: 'new_from_cim', l: 'New + CIM' },
          { v: 'cim', l: 'CIM Upload' },
          { v: 'call_notes', l: 'Call Notes' },
          { v: 'name_only', l: 'Name Only' },
        ] as const).map((opt) => (
          <button
            key={opt.v}
            onClick={() => setMode(opt.v)}
            className={`py-2 text-xs font-medium rounded transition-colors ${
              mode === opt.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* New Business + CIM mode: name input on top */}
      {mode === 'new_from_cim' && (
        <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80 leading-relaxed">
              Enter the business name and drop the CIM. The AI will read the document, extract all
              business details (revenue, employees, location, vertical…), add it to your CRM, then
              generate the DD memo.
            </p>
          </div>
          <Field label="Business Name" required>
            <input
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="e.g. Acme Plumbing Services LLC"
              className="w-full bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-primary/50"
            />
          </Field>
        </div>
      )}

      {/* Area 2 — Document input */}
      {(mode === 'cim' || mode === 'new_from_cim') && (
        <div className="mb-6">
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
              }}
              onClick={() => document.getElementById('cim-file-input')?.click()}
            >
              <input
                id="cim-file-input"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Upload className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
              <h3 className="text-base text-foreground font-medium mb-1">Drop CIM here</h3>
              <p className="text-xs text-muted-foreground">PDF, DOCX, TXT · Max 50MB</p>
            </div>
          ) : (
            <div className="border border-border rounded-md p-3 flex items-center justify-between bg-background-secondary">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-foreground truncate">{file.name}</div>
                  <div className="text-xs text-text-tertiary">{(file.size / 1024).toFixed(0)} KB</div>
                </div>
              </div>
              <button onClick={() => { setFile(null); setFileText(''); }} className="text-text-tertiary hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-text-tertiary mt-2 italic">Processed in memory only — not stored permanently</p>
        </div>
      )}

      {mode === 'call_notes' && (
        <div className="mb-6">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste notes from your owner call. Include revenue, employees, customer base, reason for selling, transition expectations."
            className="w-full min-h-[180px] bg-background-secondary border border-border rounded-md p-3 text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 resize-y"
          />
          <div className="text-[11px] text-text-tertiary mt-1.5">
            {wordCount} words {wordCount < 50 && <span>· need {50 - wordCount} more to generate</span>}
          </div>
        </div>
      )}

      {/* Area 3 — Business context */}
      <div className="space-y-4 mb-6">
        {mode !== 'new_from_cim' && (
          <Field label="Linked Business" required>
            {businesses.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No businesses in CRM — add one first.</p>
            ) : (
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-primary/50"
              >
                <option value="">Select…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.address ? ` — ${b.address.split(',')[1]?.trim() ?? ''}` : ''}</option>
                ))}
              </select>
            )}
          </Field>
        )}

        {selectedBiz?.vertical && (
          <Field label="Vertical">
            <div className="text-sm text-muted-foreground bg-background-tertiary border border-border rounded-md px-3 py-2">{selectedBiz.vertical}</div>
          </Field>
        )}

        <Field label="Analysis Label">
          <input
            value={analysisLabel}
            onChange={(e) => setAnalysisLabel(e.target.value)}
            className="w-full bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-primary/50"
            placeholder="Initial DD"
          />
        </Field>

        <Field label="Additional Context">
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Context the AI should know — seller motivation, your read on the owner, local market knowledge."
            className="w-full min-h-[80px] bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground border border-border focus:outline-none focus:border-primary/50 resize-y"
          />
        </Field>
      </div>

      {/* Area 4 — Generate */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</> : 'Generate Memo'}
      </button>
      {generating && (
        <p className="text-center text-xs text-text-tertiary mt-2 italic">This usually takes 20–40 seconds</p>
      )}

      {/* Area 5 — Prior analyses */}
      {priorMemos.length > 0 && selectedBiz && (
        <div className="mt-10">
          <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-3">
            Prior analyses for {selectedBiz.name}
          </div>
          <div className="space-y-1.5">
            {priorMemos.map((m) => (
              <button
                key={m.id}
                onClick={() => onOpenMemo(m)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-background-secondary border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-foreground">v{m.version} · {m.analysis_label ?? 'Initial DD'}</span>
                  <span className="font-mono text-[10px] text-text-tertiary">{new Date(m.generated_at).toLocaleDateString()}</span>
                </div>
                <ScorecardDots scorecard={m.sections.anacapa_fit_scorecard} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
