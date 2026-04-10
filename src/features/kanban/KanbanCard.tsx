import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { VISIBILITY_LABELS, type KanbanTask } from './types'
import { CARD_VISIBILITY_OUTLINE, visibilityPillClasses } from './tone'

export const SHOW_STATUS_ICON_ON_CARD = false
export const KANBAN_CARD_CONTEXT_ATTR = 'data-task-id'

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
  }

  return (
    <div
      ref={setNodeRef}
      data-task-id={task.id}
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
        'border-[1.5px] hover:shadow-md',
        CARD_VISIBILITY_OUTLINE[task.visibility],
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
        {/* Visibility badge */}
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
            visibilityPillClasses(task.visibility),
          )}
        >
          {VISIBILITY_LABELS[task.visibility]}
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
        <div className="mt-1.5 text-[10px]" style={{ color: 'var(--theme-muted)' }}>
          {new Date(task.dueAt).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
