import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import FloppyDiskIcon from '@hugeicons/core-free-icons/FloppyDiskIcon'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { KanbanTask, TaskPriority, TaskStatus } from './types'
import { COLUMN_LABELS } from './types'
import { priorityPillClasses, statusPillClasses } from './tone'
import { CardChat } from './CardChat'

type DrawerTab = 'details' | 'chat'

interface TaskDetailDrawerProps {
  task: KanbanTask | null
  open: boolean
  onClose: () => void
  onSave: (
    id: string,
    patch: Partial<
      Pick<
        KanbanTask,
        | 'title'
        | 'description'
        | 'status'
        | 'priority'
        | 'labels'
        | 'dueAt'
        | 'sessionId'
      >
    >,
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const STATUS_OPTIONS: TaskStatus[] = [
  'backlog',
  'todo',
  'in-progress',
  'review',
  'done',
  'cancelled',
]
const PRIORITY_OPTIONS: TaskPriority[] = ['critical', 'high', 'normal', 'low']
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

export function TaskDetailDrawer({
  task,
  open,
  onClose,
  onSave,
  onDelete,
}: TaskDetailDrawerProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [labelsInput, setLabelsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<DrawerTab>('details')

  // Sync form state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setStatus(task.status)
      setPriority(task.priority)
      setLabelsInput(task.labels.join(', '))
      setConfirmDelete(false)
      setActiveTab('details')
    }
  }, [task])

  const handleSessionCreated = async (sessionId: string) => {
    if (task) {
      await onSave(task.id, { sessionId })
    }
  }

  const handleSave = async () => {
    if (!task || !title.trim()) return
    setSaving(true)
    try {
      const labels = labelsInput
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean)
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        labels,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await onDelete(task.id)
    onClose()
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[min(440px,100vw)] flex-col border-l shadow-xl"
        style={{
          background: 'var(--theme-panel)',
          borderColor: 'var(--theme-border)',
        }}
      >
        {/* Header */}
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-base font-semibold truncate pr-2"
              style={{ color: 'var(--theme-text)' }}
            >
              {task?.title || 'Task Details'}
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </Button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {(['details', 'chat'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTab === tab
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'hover:bg-white/5',
                )}
                style={activeTab !== tab ? { color: 'var(--theme-muted)' } : undefined}
              >
                {tab === 'details' ? 'Details' : `Chat${task?.sessionId ? '' : ''}`}
              </button>
            ))}
          </div>
        </div>

        {/* Chat tab */}
        {activeTab === 'chat' && task && (
          <CardChat
            taskId={task.id}
            taskTitle={task.title}
            sessionId={task.sessionId}
            onSessionCreated={handleSessionCreated}
          />
        )}

        {/* Details tab */}
        {activeTab === 'details' && (
        <div className="flex-1 overflow-y-auto p-4">
          {task && (
            <div className="flex flex-col gap-4">
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
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
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

              {/* Meta info */}
              <div
                className="flex flex-col gap-1 rounded-lg border p-3 text-xs"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-muted)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Clock01Icon} size={12} />
                  <span>
                    Created:{' '}
                    {new Date(task.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Clock01Icon} size={12} />
                  <span>
                    Updated:{' '}
                    {new Date(task.updatedAt).toLocaleString()}
                  </span>
                </div>
                {task.assignee && (
                  <div>Assignee: {task.assignee}</div>
                )}
                <div>Version: {task.version}</div>
              </div>

              {/* Feedback */}
              {task.feedback.length > 0 && (
                <div>
                  <label
                    className="mb-1 block text-xs font-medium"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    Feedback
                  </label>
                  <div className="flex flex-col gap-2">
                    {task.feedback.map((fb, i) => (
                      <div
                        key={i}
                        className="rounded-lg border p-2 text-xs"
                        style={{
                          borderColor: 'var(--theme-border)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        <div
                          className="mb-1 text-[10px]"
                          style={{ color: 'var(--theme-muted)' }}
                        >
                          {fb.by} — {new Date(fb.at).toLocaleString()}
                        </div>
                        <div>{fb.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Footer (details tab only) */}
        {activeTab === 'details' && (
        <div
          className="flex items-center justify-between border-t px-4 py-3"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <Button
            variant={confirmDelete ? 'destructive' : 'ghost'}
            size="sm"
            onClick={handleDelete}
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
            {confirmDelete ? 'Confirm Delete' : 'Delete'}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!title.trim() || saving}
            >
              <HugeiconsIcon icon={FloppyDiskIcon} size={14} />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
        )}
      </div>
    </>
  )
}
