import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HugeiconsIcon } from '@hugeicons/react'
import Clock01Icon from '@hugeicons/core-free-icons/Clock01Icon'
import { cn } from '@/lib/utils'
import type { KanbanTask, TaskPriority } from './types'
import { priorityPillClasses } from './tone'

export const SHOW_STATUS_ICON_ON_CARD = false

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

interface KanbanCardProps {
  task: KanbanTask
  onClick?: (task: KanbanTask) => void
  overlay?: boolean
}

export function KanbanCard({ task, onClick, overlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    background: 'var(--theme-panel)',
    borderColor: 'var(--theme-border)',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.(task)
      }}
      className={cn(
        'cursor-grab rounded-lg border p-3 text-sm transition-shadow select-none',
        'hover:shadow-md',
        overlay && 'rotate-2 shadow-xl',
      )}
    >
      {/* Title */}
      <div
        className="mb-1 font-medium leading-snug line-clamp-2"
        style={{ color: 'var(--theme-text)' }}
      >
        {task.title}
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2 text-xs">
        {/* Priority badge */}
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
            priorityPillClasses(task.priority),
          )}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>

        {/* Labels */}
        {task.labels.length > 0 && (
          <span
            className="ml-auto truncate text-[10px]"
            style={{ color: 'var(--theme-muted)' }}
          >
            {task.labels.slice(0, 2).join(', ')}
            {task.labels.length > 2 && ` +${task.labels.length - 2}`}
          </span>
        )}
      </div>

      {/* Due date */}
      {task.dueAt && (
        <div
          className="mt-1.5 flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--theme-muted)' }}
        >
          <HugeiconsIcon icon={Clock01Icon} size={12} />
          <span>{new Date(task.dueAt).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  )
}
