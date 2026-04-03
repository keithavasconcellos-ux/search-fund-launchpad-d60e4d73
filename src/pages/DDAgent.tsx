import { useState } from 'react';
import { Upload, FileText, Download, Plus, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const mockMemos = [
  {
    id: '1', business: 'Northeast Electrical Services', date: 'Nov 8, 2025', model: 'claude-opus-4', sections: 8,
    scorecard: { tech: 'green', market: 'green', cashFlow: 'yellow', management: 'yellow' },
  },
];

const scorecardColors: Record<string, { bg: string; text: string; label: string; icon: any }> = {
  green: { bg: 'bg-success/20', text: 'text-success', label: 'Strong', icon: CheckCircle },
  yellow: { bg: 'bg-warning/20', text: 'text-warning', label: 'Needs Verification', icon: AlertTriangle },
  red: { bg: 'bg-destructive/20', text: 'text-destructive', label: 'Concern', icon: XCircle },
};

const memoSections = [
  { num: 1, title: 'Business Model Clarity', status: 'Extracted · pg 3–6' },
  { num: 2, title: 'Tech & Industry Stability', status: 'Extracted · pg 7–9' },
  { num: 3, title: 'Market Position', status: 'Extracted · pg 10–11' },
  { num: 4, title: 'Financial Quality', status: 'Extracted · pg 12–18' },
  { num: 5, title: 'Owner & Management', status: 'Partial · needs follow-up' },
  { num: 6, title: 'Value Creation', status: 'Extracted · pg 20–22' },
  { num: 7, title: 'Risk Register', status: '3 flags · review required' },
  { num: 8, title: 'Investment Thesis', status: 'AI synthesized' },
];

type Tab = 'upload' | 'memo' | 'library';

export default function DDAgent() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [dragOver, setDragOver] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'upload', label: 'Upload CIM' },
    { id: 'memo', label: 'Memo' },
    { id: 'library', label: 'Memo Library' },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between">
        <h1 className="font-display text-2xl text-foreground italic">Due Diligence Agent</h1>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background-tertiary text-muted-foreground text-sm hover:bg-background-quaternary transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            New Analysis
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-border flex gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'upload' && (
          <div className="p-8 max-w-2xl mx-auto">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={() => setDragOver(false)}
            >
              <Upload className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg text-foreground font-medium mb-2">Drop CIM here</h3>
              <p className="text-sm text-muted-foreground mb-4">PDF, DOCX · Max 50MB</p>
              <button className="px-4 py-2 rounded-md bg-background-quaternary text-foreground text-sm hover:bg-card transition-colors">
                Browse Files
              </button>
            </div>

            {/* Linked Business */}
            <div className="mt-6">
              <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider block mb-2">Linked Business</label>
              <select className="w-full bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground border border-border">
                <option>Northeast Electrical Services</option>
                <option>Lakeside HVAC Services</option>
                <option>Premier Pest Control</option>
              </select>
            </div>

            <button className="mt-6 w-full py-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              Generate Memo
            </button>
          </div>
        )}

        {activeTab === 'memo' && (
          <div className="flex h-full">
            {/* Sections sidebar */}
            <div className="w-[260px] border-r border-border p-4 overflow-y-auto">
              <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-3">
                Memo Sections (8)
              </div>
              {memoSections.map((s) => (
                <div key={s.num} className="py-2.5 px-2 rounded-md hover:bg-background-tertiary cursor-pointer transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-text-tertiary">S{s.num}</span>
                    <span className="text-sm text-foreground">{s.title}</span>
                  </div>
                  <div className="font-mono text-[10px] text-text-tertiary mt-0.5 pl-6">{s.status}</div>
                </div>
              ))}
            </div>

            {/* Memo Content */}
            <div className="flex-1 p-6 max-w-3xl">
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="font-display text-xl text-foreground italic">Northeast Electrical — Initial DD</h2>
                </div>
                <div className="font-mono text-[10px] text-text-tertiary">
                  GENERATED NOV 8, 2025 · claude-opus-4 · 8 SECTIONS
                </div>
              </div>

              {/* Anacapa Fit Scorecard */}
              <div className="bg-background-secondary rounded-lg p-5 border border-border mb-6">
                <h3 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Anacapa Fit Scorecard</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Tech Stability', key: 'tech', desc: 'Low disruption risk' },
                    { label: 'Market Position', key: 'market', desc: 'Strong local moat' },
                    { label: 'Cash Flow Quality', key: 'cashFlow', desc: 'Stable, converting' },
                    { label: 'Management Depth', key: 'management', desc: 'Needs verification' },
                  ].map((item) => {
                    const score = mockMemos[0].scorecard[item.key as keyof typeof mockMemos[0]['scorecard']];
                    const sc = scorecardColors[score];
                    return (
                      <div key={item.key} className={`${sc.bg} rounded-lg p-3`}>
                        <div className="flex items-center gap-2 mb-1">
                          <sc.icon className={`w-3.5 h-3.5 ${sc.text}`} />
                          <span className={`font-mono text-[10px] uppercase tracking-wider ${sc.text}`}>{item.label}</span>
                        </div>
                        <div className="text-sm text-foreground">{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sample Section */}
              <div className="bg-card rounded-lg p-5 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded">S1</span>
                  <h3 className="text-sm font-medium text-foreground">Business Model Clarity</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Northeast Electrical Services is a full-service commercial and residential electrical contractor 
                  serving the Greater Boston metro area. Revenue is approximately 60% commercial project-based and 
                  40% residential service/maintenance. The business generates revenue through time-and-materials 
                  contracts, fixed-bid projects, and recurring maintenance agreements with commercial clients.
                </p>
                <div className="mt-3 p-3 bg-background-secondary rounded-md">
                  <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Revenue Model</div>
                  <div className="text-sm text-foreground">Mixed — Project (60%) + Recurring Service (40%)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="p-6 max-w-3xl">
            {mockMemos.map((memo) => (
              <div key={memo.id} className="bg-card rounded-lg p-5 border border-border hover:border-primary/30 cursor-pointer transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-foreground">{memo.business}</h3>
                  <span className="font-mono text-[10px] text-text-tertiary">{memo.date}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mb-3">
                  {memo.model} · {memo.sections} sections
                </div>
                <div className="flex gap-2">
                  {Object.entries(memo.scorecard).map(([key, value]) => {
                    const sc = scorecardColors[value];
                    return (
                      <span key={key} className={`${sc.bg} ${sc.text} font-mono text-[10px] px-2 py-0.5 rounded`}>
                        {key}: {sc.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
