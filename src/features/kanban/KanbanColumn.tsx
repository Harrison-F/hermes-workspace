import { useEffect, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { HugeiconsIcon } from '@hugeicons/react'
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon'
import InboxIcon from '@hugeicons/core-free-icons/InboxIcon'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { KanbanTask, TaskStatus } from './types'
import { COLUMN_LABELS } from './types'
import { statusBgClass, statusBorderClass, statusTextClass } from './tone'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  status: TaskStatus
  title?: string
  tasks: KanbanTask[]
  wipLimit?: number
  onTaskClick?: (task: KanbanTask) => void
  onAddTask?: (status: TaskStatus) => void
  onRenameColumn?: (status: TaskStatus, title: string) => Promise<void>
}

export function getNextColumnTitle(currentTitle: string, draftTitle: string): string | null {
  const nextTitle = draftTitle.trim()
  if (!nextTitle || nextTitle === currentTitle) {
    return null
  }
  return nextTitle
}

export function KanbanColumn({
  status,
  title,
  tasks,
  wipLimit,
  onTaskClick,
  onAddTask,
  onRenameColumn,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'column', status },
  })

  const sorted = [...tasks].sort((a, b) => a.columnOrder - b.columnOrder)
  const taskIds = sorted.map((t) => t.id)
  const overLimit = wipLimit != null && tasks.length > wipLimit
  const resolvedTitle = title ?? COLUMN_LABELS[status]
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(resolvedTitle)

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(resolvedTitle)
    }
  }, [isEditingTitle, resolvedTitle])

  const startEditing = () => {
    if (!onRenameColumn) return
    setDraftTitle(resolvedTitle)
    setIsEditingTitle(true)
  }

  const cancelEditing = () => {
    setDraftTitle(resolvedTitle)
    setIsEditingTitle(false)
  }

  const saveTitle = async () => {
    if (!onRenameColumn) return

    const nextTitle = getNextColumnTitle(resolvedTitle, draftTitle)
    if (!nextTitle) {
      cancelEditing()
      return
    }

    await onRenameColumn(status, nextTitle)
    setIsEditingTitle(false)
  }

  return (
    <div
      className="flex w-[280px] shrink-0 flex-col rounded-xl"
      style={{
        background: isOver ? 'var(--theme-panel)' : undefined,
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {isEditingTitle ? (
            <Input
              value={draftTitle}
              autoFocus
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftTitle(e.target.value)}
              onBlur={() => {
                void saveTitle()
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void saveTitle()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelEditing()
                }
              }}
              aria-label={`Rename ${resolvedTitle} column`}
              className="h-7 max-w-[160px] text-xs font-semibold uppercase tracking-wide"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={startEditing}
              className={cn(
                'truncate text-left text-xs font-semibold uppercase tracking-wide',
                onRenameColumn && 'cursor-text',
                statusTextClass(status),
              )}
              title={onRenameColumn ? 'Double-click to rename column' : undefined}
            >
              {resolvedTitle}
            </button>
          )}
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-medium',
              overLimit
                ? 'border-red-500/30 bg-red-500/10 text-red-500'
                : `${statusBgClass(status)} ${statusBorderClass(status)} ${statusTextClass(status)}`,
            )}
          >
            {tasks.length}
            {wipLimit != null && `/${wipLimit}`}
          </span>
        </div>
        {onAddTask && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onAddTask(status)}
            aria-label={`Add task to ${resolvedTitle}`}
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
          </Button>
        )}
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-1.5 transition-colors',
          isOver && 'ring-2 ring-blue-500/30',
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {sorted.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-8">
              <HugeiconsIcon
                icon={InboxIcon}
                size={24}
                style={{ color: 'var(--theme-muted)' }}
              />
              <span
                className="text-xs"
                style={{ color: 'var(--theme-muted)' }}
              >
                No tasks
              </span>
            </div>
          ) : (
            sorted.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
