import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEmailSequences, upsertEmailSequence, deleteEmailSequence, getEmailTemplates } from '@/lib/queries/email-hub'
import { Plus, Trash2, GripVertical, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface Step {
  template_id: string | null
  delay_days: number
  step_order: number
}

export default function SequencesTab() {
  const queryClient = useQueryClient()
  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: getEmailSequences,
  })
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: getEmailTemplates,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editVertical, setEditVertical] = useState<string | null>(null)
  const [editActive, setEditActive] = useState(true)
  const [editSteps, setEditSteps] = useState<Step[]>([])

  const selected = sequences.find((s: any) => s.id === selectedId)

  const selectSequence = (seq: any) => {
    setSelectedId(seq.id)
    setEditName(seq.name)
    setEditVertical(seq.target_vertical)
    setEditActive(seq.is_active)
    setEditSteps(seq.steps ?? [])
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertEmailSequence({
        id: selectedId ?? undefined,
        name: editName,
        target_vertical: editVertical,
        is_active: editActive,
        steps: editSteps,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] })
      setSelectedId(data.id)
      toast.success('Sequence saved')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEmailSequence(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] })
      setSelectedId(null)
      toast.success('Sequence deleted')
    },
  })

  const createNew = () => {
    setSelectedId(null)
    setEditName('New Sequence')
    setEditVertical(null)
    setEditActive(true)
    setEditSteps([{ template_id: null, delay_days: 7, step_order: 0 }])
  }

  const addStep = () => {
    setEditSteps((prev) => [...prev, { template_id: null, delay_days: 7, step_order: prev.length }])
  }

  const removeStep = (idx: number) => {
    setEditSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i })))
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return
    const items = Array.from(editSteps)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setEditSteps(items.map((s, i) => ({ ...s, step_order: i })))
  }

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-[300px] border-r border-border overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            Sequences ({sequences.length})
          </span>
          <Button size="sm" variant="ghost" onClick={createNew}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {sequences.map((seq: any) => (
          <div
            key={seq.id}
            onClick={() => selectSequence(seq)}
            className={`p-3 rounded-lg border mb-2 cursor-pointer transition-colors ${
              selectedId === seq.id ? 'bg-primary/10 border-primary/30' : 'bg-card border-border hover:border-primary/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${seq.is_active ? 'bg-green-400' : 'bg-muted-foreground'}`} />
              <span className="text-sm font-medium text-foreground truncate">{seq.name}</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground mt-1">
              {seq.steps?.length ?? 0} steps · {seq.target_vertical ?? 'All verticals'}
            </div>
          </div>
        ))}
      </div>

      {/* Builder */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {editName ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-medium"
                placeholder="Sequence name"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
            </div>

            <Input
              value={editVertical ?? ''}
              onChange={(e) => setEditVertical(e.target.value || null)}
              placeholder="Target vertical (optional)"
              className="max-w-xs"
            />

            {/* Steps */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="steps">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-0">
                    {editSteps.map((step, idx) => (
                      <Draggable key={idx} draggableId={`step-${idx}`} index={idx}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps}>
                            <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
                              <div {...provided.dragHandleProps} className="mt-1 text-muted-foreground cursor-grab">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">Step {idx + 1}</span>
                                </div>
                                <Select
                                  value={step.template_id ?? ''}
                                  onValueChange={(v) => {
                                    const next = [...editSteps]
                                    next[idx] = { ...next[idx], template_id: v || null }
                                    setEditSteps(next)
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select template" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {templates.map((t: any) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Send</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={step.delay_days}
                                    onChange={(e) => {
                                      const next = [...editSteps]
                                      next[idx] = { ...next[idx], delay_days: parseInt(e.target.value) || 1 }
                                      setEditSteps(next)
                                    }}
                                    className="w-16"
                                  />
                                  <span className="text-xs text-muted-foreground">days after previous</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeStep(idx)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            {idx < editSteps.length - 1 && (
                              <div className="flex justify-center py-2">
                                <ArrowDown className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <Button variant="outline" size="sm" onClick={addStep} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> Add Step
            </Button>

            <div className="flex items-center gap-3 border-t border-border pt-4">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Save Sequence
              </Button>
              {selectedId && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(selectedId)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <p className="text-sm">Select a sequence or create a new one</p>
            <Button variant="outline" size="sm" onClick={createNew} className="gap-2">
              <Plus className="w-3.5 h-3.5" /> New Sequence
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
