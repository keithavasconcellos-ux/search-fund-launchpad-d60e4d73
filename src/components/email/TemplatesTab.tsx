import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEmailTemplates,
  upsertEmailTemplate,
  getDistinctVerticals,
  getBusinessesForTemplatePreview,
  type AiBlock,
} from '@/lib/queries/email-hub'
import { getBusinessById } from '@/lib/queries/businesses'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────

type EditFields = {
  name: string
  subject_template: string
  body_template: string
  target_vertical: string | null
  letter_number: number
  is_active: boolean
  ai_blocks: AiBlock[]
}

type TierNum = 1 | 2 | 3

type TierInfo = {
  suggested: TierNum
  maxAvailable: TierNum
  tier3Locked: boolean
  hasOwnerContact: boolean
  hasDdMemo: boolean
  hasContactNotes: boolean
}

// ── Constants ──────────────────────────────────────────────────────────

const MERGE_TAGS = [
  '{{business_name}}', '{{owner_name}}', '{{city}}', '{{state}}',
  '{{rating}}', '{{review_count}}', '{{years_in_business}}',
  '{{vertical}}', '{{service_area}}',
  '{{letter_number}}', '{{days_since_last_letter}}',
  '{{sender_name}}', '{{sender_phone}}', '{{sender_email}}',
]

const SAMPLE_DATA: Record<string, string> = {
  '{{business_name}}':        'Green Valley HVAC',
  '{{owner_name}}':           'Mike',
  '{{city}}':                 'Newton',
  '{{state}}':                'MA',
  '{{rating}}':               '4.5',
  '{{review_count}}':         '128',
  '{{years_in_business}}':    '20+',
  '{{vertical}}':             'HVAC',
  '{{service_area}}':         'Greater Boston',
  '{{letter_number}}':        '1',
  '{{days_since_last_letter}}': '14',
  '{{sender_name}}':          'Keith Vasconcellos',
  '{{sender_phone}}':         '(617) 555-0192',
  '{{sender_email}}':         'keith@acquira.com',
}

const COLD_STAGES = ['identified', 'contacted']

const TIER_LABELS: Record<TierNum, string> = {
  1: 'Business Only',
  2: 'Business + Owner',
  3: 'Full Context',
}

const TIER_DESC: Record<TierNum, string> = {
  1: 'Cold outreach — uses only public business signals. No owner references in AI blocks.',
  2: 'Research available — brings the owner in by name through what they have built.',
  3: 'Engaged prospect — draws on call notes and personal context the owner gave you.',
}

const DEFAULT_FIELDS: EditFields = {
  name: '',
  subject_template: '',
  body_template: '',
  target_vertical: null,
  letter_number: 1,
  is_active: true,
  ai_blocks: [],
}

// ── Helpers ────────────────────────────────────────────────────────────

function replaceMergeTags(text: string, data: Record<string, string>): string {
  let result = text
  for (const [tag, value] of Object.entries(data)) {
    result = result.split(tag).join(value)
  }
  return result
}

function buildLiveData(business: any): Record<string, string> {
  const owner = business?.contacts?.find((c: any) => c.is_owner)
  const cls = Array.isArray(business?.classification)
    ? business.classification[0]
    : business?.classification
  const yearsOp = business?.founded_year
    ? `${new Date().getFullYear() - business.founded_year}+`
    : '?'

  return {
    '{{business_name}}':        business?.name ?? '',
    '{{owner_name}}':           owner?.name?.split(' ')[0] ?? '{{owner_name}}',
    '{{city}}':                 business?.county ?? '',
    '{{state}}':                business?.state_abbr ?? '',
    '{{rating}}':               business?.rating?.toString() ?? '?',
    '{{review_count}}':         business?.review_count?.toString() ?? '?',
    '{{years_in_business}}':    yearsOp,
    '{{vertical}}':             cls?.vertical ?? '?',
    '{{service_area}}':         business?.county ?? '',
    '{{letter_number}}':        '1',
    '{{days_since_last_letter}}': '14',
    '{{sender_name}}':          'Keith Vasconcellos',
    '{{sender_phone}}':         '(617) 555-0192',
    '{{sender_email}}':         'keith@acquira.com',
  }
}

function detectTier(business: any): TierInfo {
  const stage = business?.crm_stage ?? ''
  const tier3Locked = COLD_STAGES.includes(stage) || !stage
  const hasOwnerContact = !!(business?.contacts?.some((c: any) => c.is_owner && c.name))
  const hasDdMemo = !!(business?.dd_memos?.length)
  const hasContactNotes = !!(business?.contacts?.some((c: any) => c.notes?.trim()))

  const tier2Available = hasOwnerContact || hasDdMemo
  const tier3Available = !tier3Locked && (hasDdMemo || hasContactNotes)

  let suggested: TierNum = 1
  if (tier3Available) suggested = 3
  else if (tier2Available) suggested = 2

  const maxAvailable: TierNum = tier3Available ? 3 : tier2Available ? 2 : 1

  return { suggested, maxAvailable, tier3Locked, hasOwnerContact, hasDdMemo, hasContactNotes }
}

function countResearchSignals(business: any): number {
  if (!business) return 0
  let count = 0
  if (business.rating)        count++
  if (business.review_count)  count++
  if (business.founded_year)  count++
  if (business.employee_count) count++
  if (business.website)       count++
  const cls = Array.isArray(business.classification) ? business.classification[0] : business.classification
  if (cls?.business_description) count++
  if (cls?.services_offered)  count++
  if (business.contacts?.some((c: any) => c.is_owner)) count++
  if (business.dd_memos?.length) count += 2
  return count
}

// ── Preview Body Renderer ──────────────────────────────────────────────

function renderBody(
  body: string,
  aiBlocks: AiBlock[],
  mergeData: Record<string, string>,
  generatedBlocks: Record<string, string>,
  mode: 'preview' | 'generate',
): React.ReactNode {
  const parts = body.split(/({{AI_BLOCK_\d+}})/)
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^{{AI_BLOCK_(\d+)}}$/)
        if (!match) {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {replaceMergeTags(part, mergeData)}
            </span>
          )
        }
        const blockNum = parseInt(match[1]) - 1
        const block = aiBlocks[blockNum]
        if (!block) {
          return (
            <span key={i} className="font-mono text-[11px] text-red-400/60">
              [orphaned block]
            </span>
          )
        }
        if (mode === 'generate' && generatedBlocks[block.id]) {
          return (
            <span
              key={i}
              className="bg-purple-500/10 border border-purple-500/25 rounded px-1 text-purple-200 italic"
            >
              {generatedBlocks[block.id]}
            </span>
          )
        }
        return (
          <span
            key={i}
            className="inline-block bg-purple-500/10 border border-purple-500/30 rounded px-2 py-0.5 font-mono text-[11px] text-purple-400 my-0.5"
          >
            ✦ AI: {block.label}
          </span>
        )
      })}
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export default function TemplatesTab() {
  const queryClient = useQueryClient()

  // Data queries
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: getEmailTemplates,
  })
  const { data: verticals = [] } = useQuery({
    queryKey: ['distinct-verticals'],
    queryFn: getDistinctVerticals,
  })
  const { data: businesses = [] } = useQuery({
    queryKey: ['businesses-for-template-preview'],
    queryFn: getBusinessesForTemplatePreview,
  })

  // Template selection & editing
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<EditFields>(DEFAULT_FIELDS)

  // AI block editor state
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [blockTierTab, setBlockTierTab] = useState<'1' | '2' | '3'>('1')

  // Preview / Generate panel state
  const [previewMode, setPreviewMode] = useState<'preview' | 'generate'>('preview')
  const [genBusinessId, setGenBusinessId] = useState<string>('')
  const [selectedTier, setSelectedTier] = useState<TierNum>(1)
  const [generatedBlocks, setGeneratedBlocks] = useState<Record<string, string>>({})
  const [isGenerating, setIsGenerating] = useState(false)

  // Refs for cursor-aware tag/block insertion
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const subjectRef = useRef<HTMLInputElement>(null)
  const lastFocusedField = useRef<'subject' | 'body'>('body')

  // Fetch full business data when selected for generation
  const { data: genBusiness } = useQuery({
    queryKey: ['business-detail', genBusinessId],
    queryFn: () => getBusinessById(genBusinessId),
    enabled: !!genBusinessId,
  })

  // Auto-suggest tier when business changes
  useEffect(() => {
    if (genBusiness) {
      const info = detectTier(genBusiness)
      setSelectedTier(info.suggested)
      setGeneratedBlocks({})
    }
  }, [genBusiness])

  // Group templates by vertical for sidebar
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const t of templates) {
      const v = t.target_vertical ?? 'General'
      if (!groups[v]) groups[v] = []
      groups[v].push(t)
    }
    return groups
  }, [templates])

  // ── Template CRUD ──────────────────────────────────────────────────

  const selectTemplate = (t: any) => {
    setSelectedId(t.id)
    setEditFields({
      name: t.name,
      subject_template: t.subject_template,
      body_template: t.body_template,
      target_vertical: t.target_vertical,
      letter_number: t.letter_number,
      is_active: t.is_active,
      ai_blocks: Array.isArray(t.ai_blocks) ? t.ai_blocks : [],
    })
    setExpandedBlockId(null)
    setGeneratedBlocks({})
  }

  const createNew = () => {
    setSelectedId('new')
    setEditFields(DEFAULT_FIELDS)
    setExpandedBlockId(null)
    setGeneratedBlocks({})
  }

  const duplicateTemplate = (t: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedId('new')
    setEditFields({
      name: `Copy of ${t.name}`,
      subject_template: t.subject_template,
      body_template: t.body_template,
      target_vertical: t.target_vertical,
      letter_number: t.letter_number,
      is_active: false,
      ai_blocks: Array.isArray(t.ai_blocks) ? t.ai_blocks : [],
    })
    setExpandedBlockId(null)
    setGeneratedBlocks({})
    toast('Duplicated — edit the name and save to create a new template')
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertEmailTemplate({
        ...(selectedId !== 'new' ? { id: selectedId! } : {}),
        ...editFields,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      setSelectedId(data.id)
      toast.success('Template saved')
    },
    onError: () => toast.error('Failed to save template'),
  })

  // ── AI Block management ────────────────────────────────────────────

  const insertAiBlock = () => {
    const blockNum = editFields.ai_blocks.length + 1
    const blockId = `block_${blockNum}`
    const marker = `{{AI_BLOCK_${blockNum}}}`

    const ta = bodyRef.current
    let newBody = editFields.body_template
    if (ta) {
      const s = ta.selectionStart ?? newBody.length
      const e = ta.selectionEnd ?? s
      newBody = newBody.slice(0, s) + marker + newBody.slice(e)
    } else {
      newBody = newBody ? newBody + '\n' + marker : marker
    }

    const newBlock: AiBlock = {
      id: blockId,
      label: `Block ${blockNum}`,
      tier1_prompt: '',
      tier2_prompt: '',
      tier3_prompt: '',
    }

    setEditFields(f => ({
      ...f,
      body_template: newBody,
      ai_blocks: [...f.ai_blocks, newBlock],
    }))
    setExpandedBlockId(blockId)
    setBlockTierTab('1')
  }

  const removeAiBlock = (blockId: string) => {
    const idx = editFields.ai_blocks.findIndex(b => b.id === blockId)
    if (idx === -1) return
    const marker = `{{AI_BLOCK_${idx + 1}}}`
    setEditFields(f => ({
      ...f,
      body_template: f.body_template.split(marker).join(''),
      ai_blocks: f.ai_blocks.filter(b => b.id !== blockId),
    }))
    if (expandedBlockId === blockId) setExpandedBlockId(null)
    const updated = { ...generatedBlocks }
    delete updated[blockId]
    setGeneratedBlocks(updated)
  }

  const updateBlockField = (
    blockId: string,
    tier: '1' | '2' | '3',
    prompt: string,
  ) => {
    setEditFields(f => ({
      ...f,
      ai_blocks: f.ai_blocks.map(b =>
        b.id === blockId ? { ...b, [`tier${tier}_prompt`]: prompt } : b
      ),
    }))
  }

  const updateBlockLabel = (blockId: string, label: string) => {
    setEditFields(f => ({
      ...f,
      ai_blocks: f.ai_blocks.map(b => b.id === blockId ? { ...b, label } : b),
    }))
  }

  // ── Merge tag insertion ────────────────────────────────────────────

  const insertMergeTag = (tag: string) => {
    if (lastFocusedField.current === 'subject') {
      const el = subjectRef.current
      const s = el?.selectionStart ?? editFields.subject_template.length
      const e = el?.selectionEnd ?? s
      setEditFields(f => ({
        ...f,
        subject_template: f.subject_template.slice(0, s) + tag + f.subject_template.slice(e),
      }))
    } else {
      const el = bodyRef.current
      const s = el?.selectionStart ?? editFields.body_template.length
      const e = el?.selectionEnd ?? s
      setEditFields(f => ({
        ...f,
        body_template: f.body_template.slice(0, s) + tag + f.body_template.slice(e),
      }))
    }
  }

  // ── AI Generation ─────────────────────────────────────────────────

  const generateBlock = async (block: AiBlock) => {
    if (!genBusinessId) {
      toast.error('Select a business first')
      return
    }
    const prompt =
      selectedTier === 1 ? block.tier1_prompt :
      selectedTier === 2 ? block.tier2_prompt :
      block.tier3_prompt

    if (!prompt.trim()) {
      toast.error(`No Tier ${selectedTier} prompt set for "${block.label}"`)
      return
    }

    setIsGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-block', {
        body: { business_id: genBusinessId, block_prompt: prompt, tier: selectedTier },
      })
      if (error) throw error
      setGeneratedBlocks(prev => ({ ...prev, [block.id]: data.text }))
    } catch {
      toast.error(`Generation failed for "${block.label}"`)
    } finally {
      setIsGenerating(false)
    }
  }

  const generateAllBlocks = async () => {
    if (!genBusinessId) {
      toast.error('Select a business first')
      return
    }
    if (editFields.ai_blocks.length === 0) {
      toast('No AI blocks in this template')
      return
    }
    setIsGenerating(true)
    setGeneratedBlocks({})
    try {
      const results = await Promise.all(
        editFields.ai_blocks.map(async block => {
          const prompt =
            selectedTier === 1 ? block.tier1_prompt :
            selectedTier === 2 ? block.tier2_prompt :
            block.tier3_prompt

          if (!prompt.trim()) return { id: block.id, text: `[No Tier ${selectedTier} prompt — set one in the editor]` }

          const { data, error } = await supabase.functions.invoke('generate-ai-block', {
            body: { business_id: genBusinessId, block_prompt: prompt, tier: selectedTier },
          })
          if (error) throw error
          return { id: block.id, text: data.text as string }
        })
      )
      const map: Record<string, string> = {}
      for (const { id, text } of results) map[id] = text
      setGeneratedBlocks(map)
      toast.success('Letter generated')
    } catch {
      toast.error('AI generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Computed values ────────────────────────────────────────────────

  const tierInfo: TierInfo | null = genBusiness ? detectTier(genBusiness) : null
  const researchSignals = countResearchSignals(genBusiness)
  const mergeData = previewMode === 'generate' && genBusiness
    ? buildLiveData(genBusiness)
    : SAMPLE_DATA
  const previewSubject = replaceMergeTags(editFields.subject_template, mergeData)

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">

      {/* ── Template Library ── */}
      <div className="w-[270px] min-w-[270px] border-r border-border overflow-y-auto p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Templates
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={createNew}>
            + New
          </Button>
        </div>

        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

        {Object.entries(grouped).map(([vertical, items]) => (
          <div key={vertical} className="mb-3">
            <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mb-1.5 px-1">
              {vertical}
            </div>
            {items.map((t: any) => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t)}
                className={`group p-2.5 rounded-lg border mb-1 cursor-pointer transition-colors ${
                  selectedId === t.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-card border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm text-foreground truncate flex-1">{t.name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => duplicateTemplate(t, e)}
                      title="Duplicate"
                      className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                    >
                      ⧉
                    </button>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.is_active ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
                  </div>
                  {!(selectedId === t.id) && (
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 group-hover:hidden ${t.is_active ? 'bg-green-400' : 'bg-muted-foreground/40'}`} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-[9px] text-muted-foreground">
                    Letter {t.letter_number}
                  </span>
                  {Array.isArray(t.ai_blocks) && t.ai_blocks.length > 0 && (
                    <span className="font-mono text-[9px] text-purple-400/70">
                      {t.ai_blocks.length} AI {t.ai_blocks.length === 1 ? 'block' : 'blocks'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Editor + Preview ── */}
      {selectedId ? (
        <div className="flex-1 flex overflow-hidden">

          {/* ── Editor panel ── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 border-r border-border min-w-0">

            {/* Name */}
            <Input
              value={editFields.name}
              onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
              placeholder="Template name"
              className="text-base font-medium"
            />

            {/* Meta row */}
            <div className="grid grid-cols-3 gap-3">
              <Select
                value={editFields.target_vertical ?? '__none__'}
                onValueChange={v =>
                  setEditFields(f => ({ ...f, target_vertical: v === '__none__' ? null : v }))
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Vertical" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All verticals</SelectItem>
                  {verticals.map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min={1}
                max={10}
                value={editFields.letter_number}
                onChange={e =>
                  setEditFields(f => ({ ...f, letter_number: parseInt(e.target.value) || 1 }))
                }
                placeholder="Letter #"
                className="text-sm"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  checked={editFields.is_active}
                  onCheckedChange={v => setEditFields(f => ({ ...f, is_active: v }))}
                />
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Subject
              </label>
              <Input
                ref={subjectRef}
                value={editFields.subject_template}
                onChange={e => setEditFields(f => ({ ...f, subject_template: e.target.value }))}
                onFocus={() => { lastFocusedField.current = 'subject' }}
                placeholder="A note about {{business_name}}"
                className="text-sm font-mono"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                  Body — Zone 1 &amp; 2 (fixed copy + merge tags)
                </label>
                <button
                  onClick={insertAiBlock}
                  className="font-mono text-[10px] text-purple-400 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded transition-colors"
                >
                  + Insert AI Block
                </button>
              </div>
              <Textarea
                ref={bodyRef}
                value={editFields.body_template}
                onChange={e => setEditFields(f => ({ ...f, body_template: e.target.value }))}
                onFocus={() => { lastFocusedField.current = 'body' }}
                rows={13}
                className="font-mono text-sm"
                placeholder={`Hi {{owner_name}},\n\n{{AI_BLOCK_1}}\n\nI've been focused on [your vertical] businesses in the [region] area and was drawn to what you've built at {{business_name}}.\n\n[Your fixed copy…]\n\nWarm regards,\n{{sender_name}}`}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use <code className="font-mono bg-muted px-1 rounded">+ Insert AI Block</code> to place a personalised AI-written paragraph. The marker appears in the text; configure its prompt in the AI Blocks section below.
              </p>
            </div>

            {/* Merge tags */}
            <div>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mr-2">
                Merge tags
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {MERGE_TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => insertMergeTag(tag)}
                    className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Blocks section */}
            {editFields.ai_blocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="font-mono text-[10px] text-purple-400 uppercase tracking-wider">
                    AI Blocks — Zone 3
                  </div>
                  <div className="flex-1 h-px bg-purple-500/20" />
                </div>

                {editFields.ai_blocks.map((block, idx) => (
                  <div
                    key={block.id}
                    className="border border-purple-500/20 rounded-lg overflow-hidden bg-purple-500/5"
                  >
                    {/* Block header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-purple-500/10 transition-colors"
                      onClick={() => setExpandedBlockId(expandedBlockId === block.id ? null : block.id)}
                    >
                      <span className="font-mono text-[10px] text-purple-400">
                        {'{{AI_BLOCK_' + (idx + 1) + '}}'}
                      </span>
                      <span className="text-xs text-foreground flex-1">{block.label || `Block ${idx + 1}`}</span>
                      <div className="flex items-center gap-2">
                        {/* Prompt completion indicator */}
                        {['1', '2', '3'].map(t => (
                          <span
                            key={t}
                            className={`font-mono text-[9px] px-1 rounded ${
                              (t === '1' ? block.tier1_prompt : t === '2' ? block.tier2_prompt : block.tier3_prompt).trim()
                                ? 'text-green-400 bg-green-400/10'
                                : 'text-muted-foreground/40 bg-muted/10'
                            }`}
                          >
                            T{t}
                          </span>
                        ))}
                        <button
                          onClick={e => { e.stopPropagation(); removeAiBlock(block.id) }}
                          className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Expanded block editor */}
                    {expandedBlockId === block.id && (
                      <div className="border-t border-purple-500/20 p-3 space-y-3">
                        {/* Block label */}
                        <Input
                          value={block.label}
                          onChange={e => updateBlockLabel(block.id, e.target.value)}
                          placeholder="Block label (e.g. Business Acknowledgement)"
                          className="text-xs h-8"
                        />

                        {/* Tier tabs */}
                        <div>
                          <div className="flex gap-0 mb-2 border border-purple-500/20 rounded overflow-hidden w-fit">
                            {(['1', '2', '3'] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => setBlockTierTab(t)}
                                className={`px-3 py-1 text-[11px] font-mono transition-colors ${
                                  blockTierTab === t
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-purple-500/10'
                                }`}
                              >
                                T{t} · {TIER_LABELS[parseInt(t) as TierNum]}
                              </button>
                            ))}
                          </div>

                          <p className="text-[11px] text-muted-foreground mb-2">
                            {TIER_DESC[parseInt(blockTierTab) as TierNum]}
                          </p>

                          <Textarea
                            value={
                              blockTierTab === '1' ? block.tier1_prompt :
                              blockTierTab === '2' ? block.tier2_prompt :
                              block.tier3_prompt
                            }
                            onChange={e => updateBlockField(block.id, blockTierTab, e.target.value)}
                            rows={4}
                            className="text-xs font-mono"
                            placeholder={
                              blockTierTab === '1'
                                ? 'Write 2 sentences acknowledging this business. Focus on how long they have been operating and what their rating signals. Do not reference the owner by name. Sound like someone who genuinely looked at their business.'
                                : blockTierTab === '2'
                                ? 'Write 2 sentences acknowledging what {{owner_name}} has built. Reference how long they have been operating, their reputation as shown by their rating and reviews. Make it feel like you specifically looked them up.'
                                : 'Write 2–3 sentences acknowledging {{owner_name}} specifically. Draw on the call notes and any personal context available. Reference something concrete and genuine that shows you paid real attention. Keep it warm but not effusive.'
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Save */}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Template'}
            </Button>
          </div>

          {/* ── Preview / Generate panel ── */}
          <div className="w-[400px] min-w-[400px] overflow-y-auto flex flex-col bg-muted/5">

            {/* Panel header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-2 z-10">
              <button
                onClick={() => setPreviewMode('preview')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  previewMode === 'preview'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Template Preview
              </button>
              <button
                onClick={() => setPreviewMode('generate')}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  previewMode === 'generate'
                    ? 'bg-purple-500/15 text-purple-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ✦ Generate
              </button>
            </div>

            <div className="p-5 flex-1">

              {/* ── Preview mode ── */}
              {previewMode === 'preview' && (
                <div className="space-y-3">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Sample preview · merge tags resolved
                  </p>
                  <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                    <div className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">
                      {previewSubject || '(no subject)'}
                    </div>
                    <div className="text-sm text-foreground font-mono leading-relaxed">
                      {renderBody(
                        editFields.body_template,
                        editFields.ai_blocks,
                        SAMPLE_DATA,
                        {},
                        'preview',
                      )}
                    </div>
                  </div>
                  {editFields.ai_blocks.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      <span className="text-purple-400">✦ AI blocks</span> are shown as placeholders. Switch to Generate to produce real content for a specific business.
                    </p>
                  )}
                </div>
              )}

              {/* ── Generate mode ── */}
              {previewMode === 'generate' && (
                <div className="space-y-4">

                  {/* Business selector */}
                  <div>
                    <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Preview for business
                    </label>
                    <Select
                      value={genBusinessId}
                      onValueChange={v => {
                        setGenBusinessId(v)
                        setGeneratedBlocks({})
                      }}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select a business…" />
                      </SelectTrigger>
                      <SelectContent>
                        {businesses.map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="flex items-center gap-2">
                              <span>{b.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {b.county}, {b.state_abbr}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Research signal indicator */}
                  {genBusiness && (
                    <div className={`text-[11px] font-mono px-2 py-1.5 rounded border ${
                      researchSignals >= 7
                        ? 'text-teal-400 bg-teal-500/10 border-teal-500/20'
                        : researchSignals >= 4
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        : 'text-muted-foreground bg-muted/10 border-border'
                    }`}>
                      {researchSignals >= 7
                        ? `Research data available — using ${researchSignals} enrichment signals`
                        : researchSignals >= 4
                        ? `Partial data — using ${researchSignals} enrichment signals`
                        : 'Minimal data — using database fields only'}
                    </div>
                  )}

                  {/* Tier selector */}
                  {genBusiness && tierInfo && (
                    <div>
                      <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Personalisation Tier
                        {tierInfo.suggested === selectedTier && (
                          <span className="ml-2 text-teal-400 normal-case tracking-normal font-sans text-[10px]">
                            · auto-suggested
                          </span>
                        )}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([1, 2, 3] as TierNum[]).map(t => {
                          const isAvailable = t <= tierInfo.maxAvailable
                          const isLocked = t === 3 && tierInfo.tier3Locked
                          const isSelected = selectedTier === t
                          const isSuggested = tierInfo.suggested === t
                          return (
                            <button
                              key={t}
                              disabled={!isAvailable || isLocked}
                              onClick={() => { setSelectedTier(t); setGeneratedBlocks({}) }}
                              title={
                                isLocked
                                  ? 'Tier 3 locked — business must be Engaged or later'
                                  : !isAvailable
                                  ? t === 2
                                    ? 'Tier 2 unlocks when owner contact or research data exists'
                                    : 'Tier 3 unlocks when call notes or contact notes exist'
                                  : TIER_DESC[t]
                              }
                              className={`relative p-2 rounded border text-left transition-all ${
                                isSelected && isAvailable
                                  ? t === 3
                                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                                    : t === 2
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                                    : 'bg-green-500/15 border-green-500/40 text-green-200'
                                  : isAvailable
                                  ? 'bg-card border-border hover:border-primary/30 text-foreground'
                                  : 'bg-muted/10 border-border/40 text-muted-foreground/40 cursor-not-allowed'
                              }`}
                            >
                              <div className="font-mono text-[9px] mb-0.5 flex items-center gap-1">
                                T{t}
                                {isSuggested && isAvailable && (
                                  <span className="text-[8px]">★</span>
                                )}
                                {isLocked && <span className="text-[8px]">🔒</span>}
                              </div>
                              <div className="text-[11px] font-medium leading-tight">
                                {TIER_LABELS[t]}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        {TIER_DESC[selectedTier]}
                      </p>
                    </div>
                  )}

                  {/* Tier 3 hard lock notice */}
                  {tierInfo?.tier3Locked && (
                    <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-2">
                      Tier 3 is locked — this business is in the{' '}
                      <span className="font-semibold">{genBusiness?.crm_stage ?? 'early'}</span> stage. Tier 3 requires Engaged or later.
                    </div>
                  )}

                  {/* Generate button */}
                  {editFields.ai_blocks.length > 0 && genBusinessId && (
                    <Button
                      onClick={generateAllBlocks}
                      disabled={isGenerating}
                      className="w-full"
                      variant="outline"
                    >
                      {isGenerating
                        ? `Generating ${editFields.ai_blocks.length} block${editFields.ai_blocks.length > 1 ? 's' : ''}…`
                        : `Generate Letter (Tier ${selectedTier}: ${TIER_LABELS[selectedTier]})`}
                    </Button>
                  )}

                  {/* Tier badge after generation */}
                  {Object.keys(generatedBlocks).length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                        selectedTier === 3
                          ? 'text-purple-400 bg-purple-500/10 border-purple-500/25'
                          : selectedTier === 2
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/25'
                          : 'text-green-400 bg-green-500/10 border-green-500/25'
                      }`}>
                        Tier {selectedTier} · {TIER_LABELS[selectedTier]}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {researchSignals} signals used
                      </span>
                    </div>
                  )}

                  {/* Per-block regenerate controls */}
                  {Object.keys(generatedBlocks).length > 0 && editFields.ai_blocks.length > 1 && (
                    <div className="space-y-1">
                      {editFields.ai_blocks.map(block => (
                        <div key={block.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-mono">{'{{AI_BLOCK_' + (editFields.ai_blocks.indexOf(block) + 1) + '}}'}</span>
                          <button
                            onClick={() => generateBlock(block)}
                            disabled={isGenerating}
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            ↺ Regenerate
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated letter preview */}
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="text-sm font-medium text-foreground border-b border-border pb-2 mb-3">
                      {previewSubject || '(no subject)'}
                    </div>
                    <div className="text-sm text-foreground font-mono leading-relaxed">
                      {editFields.body_template
                        ? renderBody(
                            editFields.body_template,
                            editFields.ai_blocks,
                            mergeData,
                            generatedBlocks,
                            'generate',
                          )
                        : <span className="text-muted-foreground italic">(empty body)</span>
                      }
                    </div>
                  </div>

                  {Object.keys(generatedBlocks).length > 0 && (
                    <p className="text-[11px] text-purple-400/70">
                      <span className="inline-block w-3 h-3 align-middle mr-1 rounded bg-purple-500/20 border border-purple-500/30" />
                      Highlighted passages were AI-generated. Edit the generated text directly in the body field before saving.
                    </p>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a template or create a new one
        </div>
      )}
    </div>
  )
}
