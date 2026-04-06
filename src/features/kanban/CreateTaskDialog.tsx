import { useState } from 'react'
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TaskPriority, TaskStatus } from './types'
import { COLUMN_LABELS } from './types'
import { priorityPillClasses, statusPillClasses } from './tone'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  boardId: string
  initialStatus?: TaskStatus
  onSubmit: (data: {
    boardId: string
    title: string
    description: string
    status: TaskStatus
    priority: TaskPriority
    labels: string[]
  }) => Promise<void>
}

const STATUS_OPTIONS: TaskStatus[] = [
  'backlog',
  'todo',
  'in-progress',
  'review',
  'done',
]
const PRIORITY_OPTIONS: TaskPriority[] = ['critical', 'high', 'normal', 'low']
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  boardId,
  initialStatus = 'todo',
  onSubmit,
}: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>(initialStatus)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [labelsInput, setLabelsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setTitle('')
    setDescription('')
    setStatus(initialStatus)
    setPriority('normal')
    setLabelsInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const labels = labelsInput
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)
      await onSubmit({
        boardId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        labels,
      })
      reset()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,92vw)]">
        <form onSubmit={handleSubmit}>
          <div className="p-5">
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription className="mt-1">
              Add a new task to the board.
            </DialogDescription>

            <div className="mt-4 flex flex-col gap-4">
              {/* Title */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  Title
                </label>
                <Input
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setTitle(e.target.value)
                  }
                  placeholder="Task title"
                  autoFocus
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  Description
                </label>
                <textarea
                  className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30"
                  style={{
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-text)',
                  }}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                />
              </div>

              {/* Status */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  Status
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        status === s
                          ? statusPillClasses(s)
                          : 'border-transparent opacity-50 hover:opacity-80',
                      )}
                      style={
                        status !== s
                          ? { color: 'var(--theme-muted)' }
                          : undefined
                      }
                    >
                      {COLUMN_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  Priority
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        priority === p
                          ? priorityPillClasses(p)
                          : 'border-transparent opacity-50 hover:opacity-80',
                      )}
                      style={
                        priority !== p
                          ? { color: 'var(--theme-muted)' }
                          : undefined
                      }
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Labels */}
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  Labels (comma-separated)
                </label>
                <Input
                  value={labelsInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLabelsInput(e.target.value)
                  }
                  placeholder="bug, feature, urgent"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex items-center justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <DialogClose>Cancel</DialogClose>
            <Button type="submit" disabled={!title.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}
