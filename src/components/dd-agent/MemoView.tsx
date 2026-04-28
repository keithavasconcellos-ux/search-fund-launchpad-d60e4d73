import { useMemo, useState } from 'react';
import { ContextPanel } from './ContextPanel';
import { AnacapaScorecard } from './AnacapaScorecard';
import { DealBreakerBanner } from './DealBreakerBanner';
import { SectionCard } from './SectionCard';
import { RiskRegister } from './RiskRegister';
import { InvestmentThesis } from './InvestmentThesis';
import type { DDMemo } from '@/lib/queries/dd-agent';

const SECTIONS = [
  { num: 1, key: 'business_overview',  title: 'Business Model Clarity' },
  { num: 2, key: 'operations',         title: 'Tech & Industry Stability' },
  { num: 3, key: 'market_position',    title: 'Market Position' },
  { num: 4, key: 'financial_profile',  title: 'Financial Quality' },
  { num: 5, key: 'management_team',    title: 'Owner & Management' },
  { num: 6, key: 'customer_analysis',  title: 'Value Creation' },
] as const;

function sectionStatus(section: { criteria: { status: string }[]; not_disclosed: string[] }) {
  if (section.criteria.some((c) => c.status === 'red')) return 'red';
  if (section.criteria.some((c) => c.status === 'yellow')) return 'yellow';
  if (section.criteria.length > 0) return 'green';
  return 'gray';
}

const borderColor: Record<string, string> = {
  red: 'border-l-destructive',
  yellow: 'border-l-warning',
  green: 'border-l-success',
  gray: 'border-l-transparent',
};

export function MemoView({
  memo,
  versions,
  onRegenerate,
  onLoadVersion,
}: {
  memo: DDMemo;
  versions: DDMemo[];
  onRegenerate: () => void;
  onLoadVersion: (m: DDMemo) => void;
}) {
  const [questions, setQuestions] = useState<{ text: string; section: number }[]>(() =>
    (memo.open_questions ?? []).map((q) => ({ text: q, section: 0 }))
  );

  const sections = memo.sections;
  const dealBreaker = sections.deal_breaker_check;

  const completeness = useMemo(() => {
    const completed = SECTIONS.filter((s) => {
      const sec = sections[s.key as keyof typeof sections] as any;
      return sec?.criteria?.length > 0
        && !sec.not_disclosed?.length
        && !sec.criteria.some((c: any) => c.status === 'red');
    }).length;
    return completed;
  }, [sections]);

  const addQ = (text: string, section: number) =>
    setQuestions((qs) => qs.some((q) => q.text === text) ? qs : [...qs, { text, section }]);

  const fmt = (key: string) => {
    const s: any = (sections as any)[key];
    return {
      summary: s?.summary ?? null,
      flags: s?.flags ?? [],
      criteria: s?.criteria ?? [],
      not_disclosed: s?.not_disclosed ?? [],
    };
  };

  const scrollTo = (n: number) => {
    document.getElementById(`memo-section-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Compute SDE for valuation calc
  const sdeCriterion = (sections.financial_profile.criteria ?? []).find(
    (c) => /SDE/i.test(c.label) && c.value
  );
  const sdeNum = sdeCriterion?.value ? extractDollars(sdeCriterion.value) : null;

  return (
    <div className="flex h-full">
      {/* Column 1 — Navigator */}
      <div className="w-[230px] flex-shrink-0 border-r border-border p-4 overflow-y-auto">
        {dealBreaker.fired && (
          <div className="mb-3 bg-destructive/15 border border-destructive/40 rounded-md px-2 py-2 text-[11px] font-mono uppercase tracking-wider text-destructive text-center">
            ⚠ Deal Breaker
          </div>
        )}
        <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-3">
          {completeness} / 8 sections complete
        </div>
        {SECTIONS.map((s) => {
          const sec = fmt(s.key);
          const status = sectionStatus(sec);
          return (
            <button
              key={s.num}
              onClick={() => scrollTo(s.num)}
              className={`w-full text-left py-2.5 px-2 rounded-md hover:bg-background-tertiary transition-colors border-l-2 ${borderColor[status]} mb-0.5`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-tertiary">S{s.num}</span>
                <span className="text-sm text-foreground">{s.title}</span>
              </div>
              <div className="font-mono text-[10px] text-text-tertiary mt-0.5 pl-6">
                {sec.criteria.length === 0 ? 'Pending' : sec.not_disclosed.length > 0 ? `${sec.not_disclosed.length} not disclosed` : 'Extracted'}
              </div>
            </button>
          );
        })}
        {/* S7 + S8 nav rows */}
        <button onClick={() => scrollTo(7)} className={`w-full text-left py-2.5 px-2 rounded-md hover:bg-background-tertiary transition-colors border-l-2 ${dealBreaker.fired ? 'border-l-destructive' : 'border-l-success'} mb-0.5`}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-text-tertiary">S7</span>
            <span className="text-sm text-foreground">Risk Register</span>
          </div>
        </button>
        <button onClick={() => scrollTo(8)} className="w-full text-left py-2.5 px-2 rounded-md hover:bg-background-tertiary transition-colors border-l-2 border-l-primary/40">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-text-tertiary">S8</span>
            <span className="text-sm text-foreground">Investment Thesis</span>
          </div>
        </button>
      </div>

      {/* Column 2 — Memo content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-display text-2xl text-foreground italic">{memo.analysis_label ?? 'DD Memo'}</h2>
            {memo.analysis_label && (
              <span className="text-[10px] font-mono uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded">
                v{memo.version}
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
            Generated {new Date(memo.generated_at).toLocaleDateString()} · {memo.model_used} · {memo.input_type ?? 'cim'} · 8 sections
          </div>
        </div>

        {dealBreaker.fired && (
          <div className="mb-5">
            <DealBreakerBanner flags={dealBreaker.flags} />
          </div>
        )}

        <div className="mb-5">
          <AnacapaScorecard scorecard={sections.anacapa_fit_scorecard} />
        </div>

        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <SectionCard
              key={s.num}
              num={s.num}
              title={s.title}
              section={fmt(s.key) as any}
              source={fmt(s.key).criteria.length === 0 ? 'Pending extraction' : 'AI synthesised'}
              onAddQuestion={(q) => addQ(q, s.num)}
            >
              {/* Valuation calculator on Section 4 */}
              {s.num === 4 && sdeNum && (
                <div className="mt-3 bg-primary/10 border border-primary/30 rounded-md p-3 text-xs text-primary">
                  <div className="font-mono uppercase tracking-wider text-[10px] text-primary/80 mb-1">Valuation range (SDE multiples)</div>
                  <div className="text-foreground font-mono">
                    3.5×: ${(sdeNum * 3.5 / 1_000_000).toFixed(2)}M  ·  4.5×: ${(sdeNum * 4.5 / 1_000_000).toFixed(2)}M  ·  5.5×: ${(sdeNum * 5.5 / 1_000_000).toFixed(2)}M
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Implied debt service @ 70% LTV, 10yr: ${(annualDebtService(sdeNum * 4.5 * 0.7, 0.085, 10) / 1000).toFixed(0)}K/yr
                  </div>
                </div>
              )}
            </SectionCard>
          ))}

          <RiskRegister
            risks={sections.risk_register ?? []}
            dealBreakerFired={dealBreaker.fired}
            flags={dealBreaker.flags}
            conditionsEvaluated={dealBreaker.conditions_evaluated ?? 6}
          />

          <InvestmentThesis
            sections={sections}
            paragraph={memo.investment_thesis}
            confidence={memo.confidence_level}
          />
        </div>
      </div>

      {/* Column 3 — Context */}
      <ContextPanel
        memo={memo}
        versions={versions}
        questions={questions}
        onRemoveQuestion={(i) => setQuestions((qs) => qs.filter((_, j) => j !== i))}
        onLoadVersion={onLoadVersion}
        onRegenerate={onRegenerate}
      />
    </div>
  );
}

function extractDollars(s: string): number | null {
  // Parse strings like "$1.2M", "$450K", "1,200,000"
  const m = s.match(/\$?\s*([\d,.]+)\s*([MmKk]?)/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(num)) return null;
  const mult = m[2].toUpperCase() === 'M' ? 1_000_000 : m[2].toUpperCase() === 'K' ? 1_000 : 1;
  return num * mult;
}

function annualDebtService(principal: number, rate: number, years: number): number {
  const r = rate / 12;
  const n = years * 12;
  const monthly = (principal * r) / (1 - Math.pow(1 + r, -n));
  return monthly * 12;
}
