import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon'
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon'
import FilterIcon from '@hugeicons/core-free-icons/FilterIcon'
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { KanbanBoard, TaskPriority, TaskStatus } from './types'
import { COLUMN_LABELS } from './types'
import type { KanbanFilters } from './hooks/useKanban'
import { priorityPillClasses, statusPillClasses } from './tone'

interface KanbanHeaderProps {
  boards: KanbanBoard[]
  activeBoardId: string | null
  onBoardSelect: (id: string) => void
  onCreateBoard: () => void
  filters: KanbanFilters
  onFiltersChange: (filters: KanbanFilters) => void
  onResetFilters: () => void
  onCreateTask: () => void
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

export function KanbanHeader({
  boards,
  activeBoardId,
  onBoardSelect,
  onCreateBoard,
  filters,
  onFiltersChange,
  onResetFilters,
  onCreateTask,
}: KanbanHeaderProps) {
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters =
    filters.search !== '' ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.labels.length > 0

  const toggleStatus = (s: TaskStatus) => {
    onFiltersChange({
      ...filters,
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    })
  }

  const togglePriority = (p: TaskPriority) => {
    onFiltersChange({
      ...filters,
      priorities: filters.priorities.includes(p)
        ? filters.priorities.filter((x) => x !== p)
        : [...filters.priorities, p],
    })
  }

  return (
    <div
      className="flex flex-col gap-3 border-b px-4 py-3"
      style={{ borderColor: 'var(--theme-border)' }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3">
        {/* Board tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {boards
            .sort((a, b) => a.order - b.order)
            .map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => onBoardSelect(board.id)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  board.id === activeBoardId
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'hover:bg-gray-500/10',
                )}
                style={{
                  color:
                    board.id === activeBoardId
                      ? undefined
                      : 'var(--theme-muted)',
                }}
              >
                {board.name}
              </button>
            ))}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCreateBoard}
            aria-label="Create board"
          >
            <HugeiconsIcon icon={Add01Icon} size={16} />
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-56">
          <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              style={{ color: 'var(--theme-muted)' }}
            />
          </div>
          <Input
            size="sm"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            className="pl-8"
          />
        </div>

        {/* Filter toggle */}
        <Button
          variant={showFilters || hasActiveFilters ? 'outline' : 'ghost'}
          size="icon-sm"
          onClick={() => setShowFilters(!showFilters)}
          aria-label="Toggle filters"
        >
          <HugeiconsIcon icon={FilterIcon} size={16} />
        </Button>

        {/* Create task */}
        <Button size="sm" onClick={onCreateTask}>
          <HugeiconsIcon icon={Add01Icon} size={14} />
          New Task
        </Button>
      </div>

      {/* Filter pills */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium" style={{ color: 'var(--theme-muted)' }}>
            Status:
          </span>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={cn(
                'rounded-md border px-2 py-0.5 transition-colors',
                filters.statuses.includes(s)
                  ? statusPillClasses(s)
                  : 'border-transparent opacity-50 hover:opacity-80',
              )}
              style={
                !filters.statuses.includes(s)
                  ? { color: 'var(--theme-muted)' }
                  : undefined
              }
            >
              {COLUMN_LABELS[s]}
            </button>
          ))}

          <span className="ml-2 font-medium" style={{ color: 'var(--theme-muted)' }}>
            Priority:
          </span>
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePriority(p)}
              className={cn(
                'rounded-md border px-2 py-0.5 transition-colors',
                filters.priorities.includes(p)
                  ? priorityPillClasses(p)
                  : 'border-transparent opacity-50 hover:opacity-80',
              )}
              style={
                !filters.priorities.includes(p)
                  ? { color: 'var(--theme-muted)' }
                  : undefined
              }
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="ml-2 flex items-center gap-1 rounded-md px-2 py-0.5 text-red-500 hover:bg-red-500/10"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={12} />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
