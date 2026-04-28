import { useState } from 'react';
import { Plus } from 'lucide-react';
import { UploadTab } from '@/components/dd-agent/UploadTab';
import { MemoView } from '@/components/dd-agent/MemoView';
import { LibraryTab } from '@/components/dd-agent/LibraryTab';
import { getMemosForBusiness, type DDMemo } from '@/lib/queries/dd-agent';

type Tab = 'upload' | 'memo' | 'library';

export default function DDAgent() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [activeMemo, setActiveMemo] = useState<DDMemo | null>(null);
  const [versions, setVersions] = useState<DDMemo[]>([]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'upload', label: 'Upload CIM' },
    { id: 'memo', label: 'Memo' },
    { id: 'library', label: 'Memo Library' },
  ];

  const openMemo = async (memo: DDMemo) => {
    setActiveMemo(memo);
    try {
      const all = await getMemosForBusiness(memo.business_id);
      setVersions(all);
    } catch {
      setVersions([memo]);
    }
    setActiveTab('memo');
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-5 border-b border-border flex items-center justify-between">
        <h1 className="font-display text-2xl text-foreground italic">Due Diligence Agent</h1>
        <button
          onClick={() => setActiveTab('upload')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Analysis
        </button>
      </div>

      {/* Tabs */}
      <div className="px-8 border-b border-border flex gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={tab.id === 'memo' && !activeMemo}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'upload' && (
          <div className="h-full overflow-auto">
            <UploadTab onMemoCreated={openMemo} onOpenMemo={openMemo} />
          </div>
        )}

        {activeTab === 'memo' && activeMemo && (
          <MemoView
            memo={activeMemo}
            versions={versions}
            onLoadVersion={(m) => setActiveMemo(m)}
            onRegenerate={() => setActiveTab('upload')}
          />
        )}

        {activeTab === 'memo' && !activeMemo && (
          <div className="h-full flex items-center justify-center text-text-tertiary italic">
            No memo selected. Generate a new one or open one from the library.
          </div>
        )}

        {activeTab === 'library' && (
          <LibraryTab onOpenMemo={openMemo} onSwitchToUpload={() => setActiveTab('upload')} />
        )}
      </div>
    </div>
  );
}
