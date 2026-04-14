import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEmailTemplates, upsertEmailTemplate, getDistinctVerticals } from '@/lib/queries/email-hub'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const MERGE_TAGS = [
  '{{business_name}}', '{{owner_name}}', '{{city}}', '{{state}}',
  '{{rating}}', '{{review_count}}', '{{years_in_business}}',
  '{{vertical}}', '{{service_area}}',
]

export default function TemplatesTab() {
  const queryClient = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: getEmailTemplates,
  })
  const { data: verticals = [] } = useQuery({
    queryKey: ['distinct-verticals'],
    queryFn: getDistinctVerticals,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({
    name: '',
    subject_template: '',
    body_template: '',
    target_vertical: null as string | null,
    letter_number: 1,
    is_active: true,
  })

  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const t of templates) {
      const v = t.target_vertical ?? 'General'
      if (!groups[v]) groups[v] = []
      groups[v].push(t)
    }
    return groups
  }, [templates])

  const selectTemplate = (t: any) => {
    setSelectedId(t.id)
    setEditFields({
      name: t.name,
      subject_template: t.subject_template,
      body_template: t.body_template,
      target_vertical: t.target_vertical,
      letter_number: t.letter_number,
      is_active: t.is_active,
    })
  }

  const createNew = () => {
    setSelectedId('new')
    setEditFields({
      name: '',
      subject_template: '',
      body_template: '',
      target_vertical: null,
      letter_number: 1,
      is_active: true,
    })
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

  // Live preview — replace merge tags with sample data
  const previewSubject = replaceMergeTags(editFields.subject_template)
  const previewBody = replaceMergeTags(editFields.body_template)

  return (
    <div className="flex h-full">
      {/* Template list */}
      <div className="w-[300px] border-r border-border overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Templates</span>
          <Button size="sm" variant="ghost" onClick={createNew}>+ New</Button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {Object.entries(grouped).map(([vertical, items]) => (
          <div key={vertical} className="mb-4">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{vertical}</div>
            {items.map((t: any) => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t)}
                className={`p-3 rounded-lg border mb-1.5 cursor-pointer transition-colors ${
                  selectedId === t.id ? 'bg-primary/10 border-primary/30' : 'bg-card border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground truncate">{t.name}</span>
                  <span className={`w-2 h-2 rounded-full ${t.is_active ? 'bg-green-400' : 'bg-muted-foreground'}`} />
                </div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  Letter {t.letter_number}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Editor + Preview */}
      {selectedId ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 border-r border-border">
            <Input
              value={editFields.name}
              onChange={(e) => setEditFields((f) => ({ ...f, name: e.target.value }))}
              placeholder="Template name"
              className="text-lg font-medium"
            />

            <div className="grid grid-cols-3 gap-3">
              <Select
                value={editFields.target_vertical ?? '__none__'}
                onValueChange={(v) => setEditFields((f) => ({ ...f, target_vertical: v === '__none__' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vertical" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All verticals</SelectItem>
                  {verticals.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min={1}
                value={editFields.letter_number}
                onChange={(e) => setEditFields((f) => ({ ...f, letter_number: parseInt(e.target.value) || 1 }))}
                placeholder="Letter #"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch checked={editFields.is_active} onCheckedChange={(v) => setEditFields((f) => ({ ...f, is_active: v }))} />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Subject Template
              </label>
              <Input
                value={editFields.subject_template}
                onChange={(e) => setEditFields((f) => ({ ...f, subject_template: e.target.value }))}
                placeholder="A note about {{business_name}}"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                Body Template
              </label>
              <Textarea
                value={editFields.body_template}
                onChange={(e) => setEditFields((f) => ({ ...f, body_template: e.target.value }))}
                rows={14}
                className="font-mono text-sm"
                placeholder="Hi {{owner_name}},&#10;&#10;I came across {{business_name}} while researching…"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground mr-1">Tags:</span>
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setEditFields((f) => ({ ...f, body_template: f.body_template + tag }))}
                  className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20"
                >
                  {tag}
                </button>
              ))}
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Save Template
            </Button>
          </div>

          {/* Live preview */}
          <div className="w-[360px] overflow-y-auto p-6 bg-muted/10">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-3">
              Live Preview
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="text-sm font-medium text-foreground mb-3">{previewSubject || '(no subject)'}</div>
              <div className="text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {previewBody || '(empty body)'}
              </div>
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

const SAMPLE_DATA: Record<string, string> = {
  '{{business_name}}': 'Green Valley HVAC',
  '{{owner_name}}': 'Mike',
  '{{city}}': 'Newton',
  '{{state}}': 'MA',
  '{{rating}}': '4.5',
  '{{review_count}}': '128',
  '{{years_in_business}}': '20+',
  '{{vertical}}': 'HVAC',
  '{{service_area}}': 'Greater Boston',
}

function replaceMergeTags(text: string): string {
  let result = text
  for (const [tag, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replaceAll(tag, value)
  }
  return result
}
