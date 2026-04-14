import { useState } from 'react'
import { Send, Inbox, ListOrdered, FileText, BarChart3, CalendarDays } from 'lucide-react'
import InboxTab from '@/components/email/InboxTab'
import ComposeTab from '@/components/email/ComposeTab'
import SequencesTab from '@/components/email/SequencesTab'
import TemplatesTab from '@/components/email/TemplatesTab'
import AnalyticsTab from '@/components/email/AnalyticsTab'
import ScheduleTab from '@/components/email/ScheduleTab'

type Tab = 'compose' | 'inbox' | 'schedule' | 'sequences' | 'templates' | 'analytics'

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'compose', label: 'Compose', icon: Send },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'sequences', label: 'Sequences', icon: ListOrdered },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function EmailHub() {
  const [activeTab, setActiveTab] = useState<Tab>('inbox')

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between">
        <h1 className="font-display text-2xl text-foreground italic">Email Hub</h1>
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
      <div className="flex-1 overflow-hidden">
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'compose' && <ComposeTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'sequences' && <SequencesTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  )
}
