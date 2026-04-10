import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { HugeiconsIcon } from '@hugeicons/react'
import LayoutGridIcon from '@hugeicons/core-free-icons/LayoutGridIcon'
import type { KanbanBoardConfig, KanbanTask, TaskStatus } from './types'
import { COLUMNS } from './types'
import { useKanbanDragDrop } from './hooks/useKanbanDragDrop'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'

interface KanbanBoardProps {
  tasks: KanbanTask[]
  config?: KanbanBoardConfig
  onTaskClick?: (task: KanbanTask) => void
  onAddTask?: (status: TaskStatus) => void
  onRenameColumn?: (status: TaskStatus, title: string) => Promise<void>
  onReorder: (id: string, status: TaskStatus, columnOrder: number) => Promise<void>
}

export function KanbanBoard({
  tasks,
  config,
  onTaskClick,
  onAddTask,
  onRenameColumn,
  onReorder,
}: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const {
    activeTask,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useKanbanDragDrop({ tasks, onReorder })

  const visibleColumns = config
    ? config.columns.filter((c) => c.visible).map((c) => c.key)
    : COLUMNS

  const tasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status)

  if (tasks.length === 0 && !config) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
        <HugeiconsIcon
          icon={LayoutGridIcon}
          size={40}
          style={{ color: 'var(--theme-muted)' }}
        />
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          No tasks yet. Create one to get started.
        </p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {visibleColumns.map((status) => {
          const colConfig = config?.columns.find((c) => c.key === status)
          return (
            <KanbanColumn
              key={status}
              status={status}
              title={colConfig?.title}
              tasks={tasksByStatus(status)}
              wipLimit={colConfig?.wipLimit}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
              onRenameColumn={onRenameColumn}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeTask ? <KanbanCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
