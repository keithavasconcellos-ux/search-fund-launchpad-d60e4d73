import { useState } from 'react';
import { Send, Inbox, ListOrdered, FileText, BarChart3, Sparkles } from 'lucide-react';

type Tab = 'compose' | 'inbox' | 'sequences' | 'templates' | 'analytics';

const emailQueue = [
  { id: '1', business: 'Green Valley HVAC', city: 'Newton MA', letter: 'Letter 1', status: 'AI draft ready', template: 'HVAC Segment' },
  { id: '2', business: 'Harbor Plumbing', city: 'Quincy MA', letter: 'Letter 1', status: 'Needs review', template: 'Plumbing Segment' },
  { id: '3', business: 'Precision Landscaping', city: 'Wellesley MA', letter: 'Letter 2', status: 'Ready to send', template: 'Landscaping' },
];

const inboxItems = [
  { id: '1', from: 'Bob Callahan', business: 'Lakeside HVAC', subject: 'Re: A note about Lakeside HVAC', preview: 'Thanks for reaching out. I would be happy to discuss…', time: '2h ago', positive: true },
  { id: '2', from: 'Sarah Mitchell', business: 'Premier Pest Control', subject: 'Re: Premier Pest Control', preview: 'Not interested at this time.', time: '1d ago', positive: false },
];

const analyticsData = {
  sent: 612, openRate: 38.2, responseRate: 12.4, positiveRate: 4.1,
  byIndustry: [
    { name: 'HVAC', rate: 15.6 }, { name: 'Plumbing', rate: 11.2 }, { name: 'Pest Ctrl', rate: 13.8 },
    { name: 'Electrical', rate: 8.9 }, { name: 'Roofing', rate: 7.4 },
  ],
  byLetter: [
    { name: 'Letter 1', rate: 12.1 }, { name: 'Letter 2', rate: 15.8 }, { name: 'Letter 3', rate: 10.7 },
    { name: 'Follow-Up', rate: 8.8 }, { name: 'Letter 4+', rate: 5.9 },
  ],
};

export default function EmailHub() {
  const [activeTab, setActiveTab] = useState<Tab>('compose');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'compose', label: 'Compose', icon: Send },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'sequences', label: 'Sequences', icon: ListOrdered },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between">
        <h1 className="font-display text-2xl text-foreground italic">Email Hub</h1>
        <span className="font-mono text-xs text-muted-foreground">34 sent today</span>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-border flex gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'compose' && (
          <div className="flex h-full">
            {/* Queue */}
            <div className="w-[280px] border-r border-border p-4 overflow-y-auto">
              <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-3">
                Target Queue ({emailQueue.length})
              </div>
              {emailQueue.map((item) => (
                <div key={item.id} className="p-3 rounded-lg bg-background-secondary border border-border mb-2 cursor-pointer hover:border-primary/30 transition-colors">
                  <div className="text-sm font-medium text-foreground mb-0.5">{item.business}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{item.city} · {item.letter}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="font-mono text-[10px] text-primary">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <div className="flex-1 p-6 max-w-2xl">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider w-12">To</label>
                  <div className="flex-1 bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground">
                    owner@greenvalleyhvac.com
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider w-12">From</label>
                  <div className="flex-1 bg-background-tertiary rounded-md px-3 py-2 text-sm text-muted-foreground">
                    john@searchco.com
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider w-12">Subj</label>
                  <div className="flex-1 bg-background-tertiary rounded-md px-3 py-2 text-sm text-foreground">
                    A note about Green Valley HVAC
                  </div>
                </div>
                <div className="bg-background-tertiary rounded-lg p-4 min-h-[300px]">
                  <p className="text-sm text-foreground leading-relaxed">
                    Hi Mike,
                  </p>
                  <p className="text-sm text-foreground leading-relaxed mt-3">
                    I came across Green Valley HVAC while researching established HVAC businesses in the Greater Boston area. 
                    <span className="bg-primary/20 px-0.5 rounded">Your 4.5-star rating and 20+ years serving Newton speak to the kind of business I've been looking for.</span>
                  </p>
                  <p className="text-sm text-foreground leading-relaxed mt-3">
                    I'm an MBA-trained search fund entrepreneur actively looking to acquire and operate a company in the $2–10M revenue range. I'm drawn to businesses with strong local reputations and recurring customer relationships…
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-primary">
                    <Sparkles className="w-3 h-3" />
                    AI personalized — highlighted text was tailored using business metadata
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                    <Send className="w-3.5 h-3.5" />
                    Send Now
                  </button>
                  <button className="px-4 py-2 rounded-md bg-background-quaternary text-muted-foreground text-sm hover:text-foreground transition-colors">
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="p-6 max-w-3xl">
            <div className="space-y-2">
              {inboxItems.map((item) => (
                <div key={item.id} className="bg-card rounded-lg p-4 border border-border hover:border-primary/30 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.from}</span>
                      <span className="font-mono text-[10px] text-text-tertiary">· {item.business}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${item.positive ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                        {item.positive ? 'Positive' : 'Negative'}
                      </span>
                      <span className="font-mono text-[10px] text-text-tertiary">{item.time}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">{item.subject}</div>
                  <div className="text-xs text-text-tertiary">{item.preview}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="p-6 max-w-4xl">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Emails Sent (30d)', value: analyticsData.sent.toString(), change: '↑ 18% vs prior' },
                { label: 'Open Rate', value: `${analyticsData.openRate}%`, change: '↑ 2.1pp' },
                { label: 'Response Rate', value: `${analyticsData.responseRate}%`, change: '↑ 1.8pp' },
                { label: 'Positive Response', value: `${analyticsData.positiveRate}%`, change: '↓ 0.3pp' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-card rounded-lg p-5 border border-border">
                  <div className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-2">{kpi.label}</div>
                  <div className="text-2xl font-semibold text-foreground font-mono">{kpi.value}</div>
                  <div className={`text-xs mt-1 font-mono ${kpi.change.startsWith('↑') ? 'text-success' : 'text-destructive'}`}>{kpi.change}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* By Industry */}
              <div className="bg-card rounded-lg p-5 border border-border">
                <h3 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Response Rate by Industry</h3>
                <div className="space-y-3">
                  {analyticsData.byIndustry.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground w-20">{item.name}</span>
                      <div className="flex-1 bg-background-tertiary rounded-full h-2">
                        <div className="bg-primary rounded-full h-2" style={{ width: `${(item.rate / 20) * 100}%` }} />
                      </div>
                      <span className="font-mono text-xs text-foreground w-12 text-right">{item.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Letter */}
              <div className="bg-card rounded-lg p-5 border border-border">
                <h3 className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider mb-4">Response Rate by Letter Type</h3>
                <div className="space-y-3">
                  {analyticsData.byLetter.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground w-20">{item.name}</span>
                      <div className="flex-1 bg-background-tertiary rounded-full h-2">
                        <div className="bg-teal rounded-full h-2" style={{ width: `${(item.rate / 20) * 100}%` }} />
                      </div>
                      <span className="font-mono text-xs text-foreground w-12 text-right">{item.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sequences' && (
          <div className="p-6 max-w-3xl">
            <div className="bg-card rounded-lg p-5 border border-border">
              <h3 className="text-sm font-medium text-foreground mb-4">Active Sequences</h3>
              <div className="space-y-3">
                {['HVAC Owner Letter Sequence', 'Plumbing Cold Outreach v2', 'Pest Control Intro'].map((seq, i) => (
                  <div key={seq} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div>
                      <div className="text-sm text-foreground">{seq}</div>
                      <div className="font-mono text-[10px] text-text-tertiary">{[5, 3, 2][i]} letters · {[14, 10, 7][i]} day cadence</div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{[24, 18, 8][i]} active</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-6 max-w-3xl">
            <div className="bg-card rounded-lg p-5 border border-border">
              <h3 className="text-sm font-medium text-foreground mb-4">Template Library</h3>
              <div className="space-y-3">
                {['Owner Letter v3 — HVAC', 'Owner Letter v3 — Plumbing', 'Follow-Up — General', 'Introduction — Pest Control', 'Letter 2 — Interest Signal'].map((t) => (
                  <div key={t} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="text-sm text-foreground">{t}</div>
                    <button className="text-xs text-primary hover:text-primary/80">Edit →</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
