import { ArrowUp, Mail, MessageSquare, FileText, RefreshCw, Plus, Search, Send } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPipelineFunnelCounts } from '@/lib/queries/dashboard';
import { CRM_STAGE_LABELS, type CrmStage } from '@/types/acquira';

const FUNNEL_STAGE_META: { stage: CrmStage; hsl: string }[] = [
  { stage: 'identified',   hsl: 'var(--primary)' },
  { stage: 'contacted',    hsl: 'var(--primary)' },
  { stage: 'engaged',      hsl: 'var(--purple)' },
  { stage: 'nda_signed',   hsl: 'var(--warning)' },
  { stage: 'cim_received', hsl: 'var(--destructive)' },
  { stage: 'active_loi',   hsl: 'var(--destructive)' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Dummy data (placeholder until wired to Supabase)
// ──────────────────────────────────────────────────────────────────────────────

const KPIS_TOP = [
  { label: 'Businesses Tracked', value: '30,241', sub: '+847 this month', tone: 'up' as const, accent: 'primary' },
  { label: 'Emails Sent (7d)', value: '342', sub: '+18% vs prior week', tone: 'up' as const, accent: 'purple' },
  { label: 'Reply Rate (7d)', value: '4.7%', sub: 'Above 4.2% target', tone: 'up' as const, accent: 'success' },
  { label: 'Positive Rate (7d)', value: '38%', sub: 'of replies were positive', tone: 'neutral' as const, accent: 'warning' },
];

const KPIS_BOTTOM = [
  { label: 'In CRM Pipeline', value: '84', sub: 'across all active stages', tone: 'neutral' as const, accent: 'primary' },
  { label: 'Engaged or Beyond', value: '12', sub: '3 moved up this week', tone: 'up' as const, accent: 'purple' },
  { label: 'Calls This Week', value: '3', sub: '1 remaining today', tone: 'neutral' as const, accent: 'success' },
  { label: 'Letters in Queue', value: '47', sub: 'Ready to review & send', tone: 'warn' as const, accent: 'warning' },
];



const ACTIVITY = [
  { icon: MessageSquare, tone: 'success', html: <><strong>Northeast Electrical</strong> replied — Positive</>, time: 'Today, 8:42 AM' },
  { icon: ArrowUp,       tone: 'primary', html: <><strong>Beacon Plumbing Co.</strong> moved to NDA Signed</>, time: 'Yesterday, 3:18 PM' },
  { icon: FileText,      tone: 'purple',  html: <><strong>Harbor HVAC Group</strong> — memo generated</>, time: 'Yesterday, 1:05 PM' },
  { icon: Mail,          tone: 'warning', html: <>Letter batch sent — <strong>47 businesses</strong></>, time: 'Mon 27 Apr, 9:00 AM' },
  { icon: Search,        tone: 'primary', html: <>Research run — <strong>Green Valley Pest Control</strong></>, time: 'Mon 27 Apr, 8:20 AM' },
];

const CALLS = [
  { time: '10:30 AM', date: 'Today',      name: 'Mike Callahan',  biz: 'Northeast Electrical Services · Engaged',  dot: 'success' },
  { time: '2:00 PM',  date: 'Wed 30 Apr', name: 'Bob Demarco',    biz: 'Beacon Plumbing Co. · NDA Signed',         dot: 'warning' },
  { time: '11:00 AM', date: 'Fri 2 May',  name: 'Sandra Okafor',  biz: 'Harbor HVAC Group · CIM Received',         dot: 'destructive' },
];

const ATTENTION = [
  { name: 'Northeast Electrical',   meta: 'HVAC · Newton, MA',         stage: 'Engaged',      stageClass: 'badge-engaged',   reason: 'Positive reply — no action',  days: '2 days', urgency: 'urgent', action: 'Follow up →' },
  { name: 'Cape Ann Pest Control',  meta: 'Pest Control · Gloucester, MA', stage: 'NDA Signed', stageClass: 'badge-nda',     reason: 'CIM not yet received',        days: '8 days', urgency: 'urgent', action: 'Send reminder →' },
  { name: 'South Shore Electric',   meta: 'Electrical · Quincy, MA',   stage: 'Contacted',    stageClass: 'badge-contacted', reason: 'Letter 2 due',                days: '1 day',  urgency: 'warn',   action: 'Queue letter →' },
  { name: 'Harbor HVAC Group',      meta: 'HVAC · Salem, MA',          stage: 'CIM Received', stageClass: 'badge-cim',       reason: 'No DD memo generated',        days: '3 days', urgency: 'warn',   action: 'Generate memo →' },
  { name: 'Minuteman Mechanical',   meta: 'Plumbing · Lexington, MA',  stage: 'Engaged',      stageClass: 'badge-engaged',   reason: 'No research run',             days: '5 days', urgency: 'ok',     action: 'Run research →' },
  { name: 'Braintree HVAC Services',meta: 'HVAC · Braintree, MA',      stage: 'Active LOI',   stageClass: 'badge-loi',       reason: 'Investor update overdue',     days: '5 days', urgency: 'urgent', action: 'Draft update →' },
];

const SPARK = [35, 55, 45, 70, 90, 80, 98];

const DEALS = [
  { score: 87, name: 'Braintree HVAC Services', meta: '$2.1M–$3.2M est.  ·  Active LOI',   tone: 'success', squares: ['g','g','y','g'] },
  { score: 74, name: 'Harbor HVAC Group',       meta: '$1.8M–$2.6M est.  ·  CIM Received', tone: 'warning', squares: ['g','y','r','n'] },
  { score: 71, name: 'Beacon Plumbing Co.',     meta: '$1.4M–$2.0M est.  ·  NDA Signed',   tone: 'primary', squares: ['g','g','n','n'] },
  { score: 62, name: 'Northeast Electrical',    meta: 'Est. revenue TBD  ·  Engaged',      tone: 'muted',   squares: ['n','n','n','n'] },
];

const VERTICALS = [
  { name: 'HVAC',        rate: '6.2% reply rate', width: 100, color: 'hsl(var(--primary))' },
  { name: 'Electrical',  rate: '5.1% reply rate', width: 82,  color: 'hsl(var(--primary) / 0.7)' },
  { name: 'Plumbing',    rate: '4.7% reply rate', width: 76,  color: 'hsl(var(--purple))' },
  { name: 'Pest Control',rate: '3.8% reply rate', width: 61,  color: 'hsl(var(--warning))' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function accentColor(accent: string): string {
  switch (accent) {
    case 'primary': return 'hsl(var(--primary))';
    case 'purple':  return 'hsl(var(--purple))';
    case 'success': return 'hsl(var(--success))';
    case 'warning': return 'hsl(var(--warning))';
    case 'destructive': return 'hsl(var(--destructive))';
    default: return 'hsl(var(--primary))';
  }
}

function toneClass(tone: 'up' | 'neutral' | 'warn'): string {
  if (tone === 'up') return 'text-success';
  if (tone === 'warn') return 'text-warning';
  return 'text-text-tertiary';
}

function iconToneClasses(tone: string) {
  switch (tone) {
    case 'success': return { bg: 'bg-success/10', border: 'border-success/30', fg: 'text-success' };
    case 'primary': return { bg: 'bg-primary/10', border: 'border-primary/30', fg: 'text-primary' };
    case 'purple':  return { bg: 'bg-[hsl(var(--purple)/0.10)]', border: 'border-[hsl(var(--purple)/0.30)]', fg: 'text-[hsl(var(--purple))]' };
    case 'warning': return { bg: 'bg-warning/10', border: 'border-warning/30', fg: 'text-warning' };
    case 'destructive': return { bg: 'bg-destructive/10', border: 'border-destructive/30', fg: 'text-destructive' };
    default: return { bg: 'bg-muted', border: 'border-border', fg: 'text-muted-foreground' };
  }
}

function dotColor(tone: string) {
  switch (tone) {
    case 'success': return 'hsl(var(--success))';
    case 'warning': return 'hsl(var(--warning))';
    case 'destructive': return 'hsl(var(--destructive))';
    default: return 'hsl(var(--primary))';
  }
}

function squareClass(s: string) {
  switch (s) {
    case 'g': return 'bg-success';
    case 'y': return 'bg-warning';
    case 'r': return 'bg-destructive';
    default:  return 'bg-background-quaternary border border-border';
  }
}

function dealScoreStyle(tone: string): React.CSSProperties {
  const map: Record<string, { bg: string; fg: string; border: string }> = {
    success: { bg: 'hsl(var(--success) / 0.1)', fg: 'hsl(var(--success))', border: 'hsl(var(--success) / 0.3)' },
    warning: { bg: 'hsl(var(--warning) / 0.1)', fg: 'hsl(var(--warning))', border: 'hsl(var(--warning) / 0.3)' },
    primary: { bg: 'hsl(var(--primary) / 0.1)', fg: 'hsl(var(--primary))', border: 'hsl(var(--primary) / 0.3)' },
    muted:   { bg: 'hsl(var(--background-quaternary))', fg: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))' },
  };
  const c = map[tone] ?? map.muted;
  return { backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}` };
}

function StageBadgeMock({ stage, cls }: { stage: string; cls: string }) {
  const styles: Record<string, React.CSSProperties> = {
    'badge-identified': { background: 'hsl(var(--background-quaternary))', color: 'hsl(213 30% 60%)', border: '1px solid hsl(var(--border))' },
    'badge-contacted':  { background: 'hsl(var(--success) / 0.12)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success) / 0.3)' },
    'badge-engaged':    { background: 'hsl(var(--purple) / 0.12)', color: 'hsl(var(--purple))', border: '1px solid hsl(var(--purple) / 0.3)' },
    'badge-nda':        { background: 'hsl(var(--warning) / 0.12)', color: 'hsl(var(--warning))', border: '1px solid hsl(var(--warning) / 0.3)' },
    'badge-cim':        { background: 'hsl(38 92% 50% / 0.15)', color: 'hsl(38 92% 60%)', border: '1px solid hsl(38 92% 50% / 0.3)' },
    'badge-loi':        { background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)' },
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[9px] font-medium uppercase tracking-wider whitespace-nowrap"
      style={styles[cls] ?? styles['badge-identified']}
    >
      {stage}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-7 mb-3 font-mono text-[9px] text-text-tertiary uppercase tracking-[2px]">
      <span>{children}</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

function CardLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3.5 font-mono text-[9px] text-text-tertiary uppercase tracking-[1.8px]">
      <span>{children}</span>
      {action}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'EEEE, d MMMM yyyy');
  const refreshed = format(new Date(), 'h:mm a');

  const { data: funnelCounts = {} } = useQuery({
    queryKey: ['pipeline-funnel'],
    queryFn: getPipelineFunnelCounts,
    refetchInterval: 60_000,
  });

  const maxFunnel = Math.max(1, ...FUNNEL_STAGE_META.map((m) => funnelCounts[m.stage] ?? 0));
  const funnel = FUNNEL_STAGE_META.map((m) => {
    const count = funnelCounts[m.stage] ?? 0;
    const pct = (count / maxFunnel) * 100;
    return {
      label: CRM_STAGE_LABELS[m.stage],
      count,
      // Keep a minimum so the count label stays readable on tiny bars
      width: count > 0 ? Math.max(pct, 6) : 0,
      hsl: m.hsl,
    };
  });

  const conv = (from: CrmStage, to: CrmStage) => {
    const a = funnelCounts[from] ?? 0;
    const b = funnelCounts[to] ?? 0;
    return a > 0 ? `${Math.round((b / a) * 100)}%` : '—';
  };

  return (
    <div className="px-10 pt-9 pb-16 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between mb-9">
        <div>
          <h1 className="font-display italic text-[36px] leading-none text-foreground tracking-tight">
            Good morning, Keith
          </h1>
          <div className="flex items-center gap-2 mt-1.5 font-mono text-[10px] text-text-tertiary uppercase tracking-[1.5px]">
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-success">
              <span className="absolute inset-0 rounded-full bg-success/50 animate-ping" />
            </span>
            <span>{today} · Last refreshed {refreshed}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-background-tertiary border border-border text-muted-foreground font-mono text-[11px] hover:bg-background-quaternary hover:text-foreground transition-colors">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* ROW 1: KPI top */}
      <SectionLabel>Outreach · Last 7 days</SectionLabel>

      <div className="grid grid-cols-4 gap-3.5 mb-3.5">
        {KPIS_TOP.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        {KPIS_BOTTOM.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* ROW 2: Pipeline + Activity */}
      <SectionLabel>Pipeline & Activity</SectionLabel>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        {/* Pipeline funnel — spans 2 */}
        <div className="col-span-2 bg-card border border-border rounded-[10px] p-5">
          <CardLabel action={<button onClick={() => navigate('/crm')} className="font-mono text-[9px] text-primary hover:text-primary/80">View CRM →</button>}>
            Pipeline Funnel
          </CardLabel>

          <div className="space-y-2.5">
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="font-mono text-[10px] text-muted-foreground w-24 text-right shrink-0">{f.label}</div>
                <div className="flex-1 h-6 bg-background-tertiary rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center px-2.5 transition-all duration-500"
                    style={{
                      width: `${f.width}%`,
                      background: `linear-gradient(90deg, hsl(${f.hsl} / 0.18), hsl(${f.hsl} / 0.45))`,
                    }}
                  >
                    <span className="font-mono text-[11px] font-medium" style={{ color: `hsl(${f.hsl})` }}>
                      {f.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3.5 border-t border-border grid grid-cols-3 gap-2">
            {[
              { l: 'Contacted→Engaged', v: conv('contacted', 'engaged') },
              { l: 'Engaged→NDA',       v: conv('engaged', 'nda_signed') },
              { l: 'NDA→CIM',           v: conv('nda_signed', 'cim_received') },
            ].map((m) => (
              <div key={m.l}>
                <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-wider mb-1">{m.l}</div>
                <div className="font-mono text-sm font-semibold text-foreground">{m.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-[10px] p-5">
          <CardLabel>Recent Activity</CardLabel>
          <div>
            {ACTIVITY.map((a, i) => {
              const Icon = a.icon;
              const t = iconToneClasses(a.tone);
              return (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${t.bg} border ${t.border}`}>
                    <Icon className={`w-3 h-3 ${t.fg}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-foreground leading-tight">{a.html}</div>
                    <div className="font-mono text-[9.5px] text-text-tertiary mt-0.5">{a.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 3: Calls + Needs Attention */}
      <SectionLabel>Priority Actions</SectionLabel>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        {/* Upcoming Calls — spans 1 */}
        <div className="bg-card border border-border rounded-[10px] p-5">
          <CardLabel action={<button onClick={() => navigate('/email')} className="font-mono text-[9px] text-primary hover:text-primary/80">Schedule →</button>}>
            Upcoming Calls
          </CardLabel>

          {CALLS.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <div className="w-14 shrink-0">
                <div className="font-mono text-[10px] text-primary leading-tight">{c.time}</div>
                <div className="font-mono text-[9px] text-text-tertiary mt-0.5">{c.date}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-foreground font-medium">{c.name}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{c.biz}</div>
              </div>
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: dotColor(c.dot), boxShadow: `0 0 6px ${dotColor(c.dot)}` }}
              />
            </div>
          ))}

          <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between font-mono text-[10px] text-text-tertiary">
            <span>3 calls scheduled this week</span>
            <button className="text-primary hover:text-primary/80">+ Add call</button>
          </div>
        </div>

        {/* Needs Attention — spans 2 */}
        <div className="col-span-2 bg-card border border-border rounded-[10px] p-5">
          <CardLabel action={<span className="font-mono text-[9px] text-warning normal-case">{ATTENTION.length} items</span>}>
            Needs Attention
          </CardLabel>

          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Business','Stage','Reason','Overdue',''].map((h) => (
                  <th key={h} className="text-left font-mono text-[9px] text-text-tertiary uppercase tracking-[1.5px] pb-2.5 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATTENTION.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="text-[13px] text-foreground font-medium">{row.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{row.meta}</div>
                  </td>
                  <td className="py-2.5 pr-3 align-middle"><StageBadgeMock stage={row.stage} cls={row.stageClass} /></td>
                  <td className="py-2.5 pr-3 align-middle">
                    <span className="font-mono text-[10px] text-muted-foreground">{row.reason}</span>
                  </td>
                  <td className="py-2.5 pr-3 align-middle">
                    <span
                      className={`font-mono text-[10px] ${
                        row.urgency === 'urgent' ? 'text-destructive' :
                        row.urgency === 'warn'   ? 'text-warning' :
                                                   'text-muted-foreground'
                      }`}
                    >
                      {row.days}
                    </span>
                  </td>
                  <td className="py-2.5 text-right align-middle">
                    <button className="font-mono text-[10px] text-primary hover:text-foreground whitespace-nowrap">{row.action}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ROW 4: Outreach + Deals + Reply Mix */}
      <SectionLabel>Outreach & Deals</SectionLabel>

      <div className="grid grid-cols-3 gap-3.5">
        {/* Outreach this week */}
        <div className="bg-card border border-border rounded-[10px] p-5">
          <CardLabel>Outreach This Week</CardLabel>

          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="font-mono text-[28px] font-semibold text-foreground tracking-tight leading-none">342</div>
              <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-wider mt-1.5">of 350 target</div>
            </div>
            <div className="flex items-end gap-[3px] h-7">
              {SPARK.map((h, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: i === 4 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.35)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between mb-1.5">
              <span className="text-[12px] text-muted-foreground">Weekly target</span>
              <span className="font-mono text-[10px] text-text-tertiary">342 / 350</span>
            </div>
            <div className="h-[5px] bg-background-tertiary rounded overflow-hidden">
              <div className="h-full rounded bg-primary" style={{ width: '97.7%' }} />
            </div>
          </div>

          <div className="mt-3.5">
            {[
              { name: 'New letters (L1)',  val: '50' },
              { name: 'Follow-ups (L2)',   val: '45' },
              { name: 'Emails (L3)',       val: '40' },
              { name: 'Calls made',        val: '12' },
              { name: 'Open rate (7d)',    val: '28.4%', valColor: 'text-success' },
            ].map((s) => (
              <div key={s.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-[13px] text-muted-foreground">{s.name}</span>
                <span className={`font-mono text-[13px] font-medium ${s.valColor ?? 'text-foreground'}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Deals */}
        <div className="bg-card border border-border rounded-[10px] p-5">
          <CardLabel action={<button onClick={() => navigate('/crm')} className="font-mono text-[9px] text-primary hover:text-primary/80">View all →</button>}>
            Active Deals
          </CardLabel>

          {DEALS.map((d, i) => (
            <div key={i} className="flex items-center gap-3.5 py-3 border-b border-border last:border-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-mono text-[13px] font-semibold shrink-0"
                style={dealScoreStyle(d.tone)}
              >
                {d.score}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-foreground font-medium truncate">{d.name}</div>
                <div className="font-mono text-[9.5px] text-muted-foreground mt-0.5 truncate">{d.meta}</div>
              </div>
              <div className="flex gap-1">
                {d.squares.map((s, j) => (
                  <div key={j} className={`w-2.5 h-2.5 rounded-sm ${squareClass(s)}`} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Reply breakdown + verticals */}
        <div className="bg-card border border-border rounded-[10px] p-5">
          <CardLabel>Reply Breakdown (30d)</CardLabel>

          <div className="flex items-center gap-5 mb-5">
            <div className="relative w-20 h-20 shrink-0">
              <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="30" fill="none" stroke="hsl(var(--background-tertiary))" strokeWidth="12" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="hsl(var(--success))" strokeWidth="12" strokeDasharray="71.6 188.5" strokeDashoffset="0" strokeLinecap="round" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="hsl(var(--warning))" strokeWidth="12" strokeDasharray="52.8 188.5" strokeDashoffset="-71.6" strokeLinecap="round" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="hsl(var(--destructive))" strokeWidth="12" strokeDasharray="33.9 188.5" strokeDashoffset="-124.4" strokeLinecap="round" />
                <circle cx="40" cy="40" r="30" fill="none" stroke="hsl(var(--text-tertiary))" strokeWidth="12" strokeDasharray="30.2 188.5" strokeDashoffset="-158.3" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono text-base font-semibold text-foreground">4.7%</div>
                <div className="font-mono text-[8px] text-text-tertiary uppercase tracking-wider">reply</div>
              </div>
            </div>
            <div className="flex-1">
              {[
                { c: 'hsl(var(--success))',     l: 'Positive',      v: '38%' },
                { c: 'hsl(var(--warning))',     l: 'Neutral',       v: '28%' },
                { c: 'hsl(var(--destructive))', l: 'Negative',      v: '18%' },
                { c: 'hsl(var(--text-tertiary))', l: 'Out of office', v: '16%' },
              ].map((row) => (
                <div key={row.l} className="flex items-center gap-2 mb-1.5 last:mb-0 text-[12px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: row.c }} />
                  <span>{row.l}</span>
                  <span className="ml-auto font-mono text-[11px] text-foreground">{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          <CardLabel>Top Performing Verticals</CardLabel>

          {VERTICALS.map((v) => (
            <div key={v.name} className="mb-2 last:mb-0">
              <div className="flex justify-between mb-1.5">
                <span className="text-[12px] text-muted-foreground">{v.name}</span>
                <span className="font-mono text-[10px] text-text-tertiary">{v.rate}</span>
              </div>
              <div className="h-[5px] bg-background-tertiary rounded overflow-hidden">
                <div className="h-full rounded transition-all" style={{ width: `${v.width}%`, background: v.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// KPI Card
// ──────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, tone, accent,
}: {
  label: string; value: string; sub: string; tone: 'up' | 'neutral' | 'warn'; accent: string;
}) {
  const color = accentColor(accent);
  return (
    <div className="relative bg-card border border-border rounded-[10px] p-5 pb-4 overflow-hidden hover:border-border transition-colors">
      <div
        className="absolute top-0 inset-x-0 h-[2px] opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <div className="font-mono text-[9px] text-text-tertiary uppercase tracking-[1.8px] mb-2.5">
        {label}
      </div>
      <div className="font-mono text-[30px] font-semibold text-foreground leading-none tracking-tight">
        {value}
      </div>
      <div className={`flex items-center gap-1.5 mt-2 font-mono text-[10px] ${toneClass(tone)}`}>
        {tone === 'up' && <ArrowUp className="w-2.5 h-2.5" />}
        {sub}
      </div>
    </div>
  );
}
