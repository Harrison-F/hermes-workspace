import { useCallback, useState } from 'react'
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import type { KanbanTask, TaskStatus } from '../types'

export interface UseKanbanDragDropOptions {
  tasks: KanbanTask[]
  onReorder: (id: string, status: TaskStatus, columnOrder: number) => Promise<void>
}

export interface UseKanbanDragDropReturn {
  activeTaskId: string | null
  activeTask: KanbanTask | null
  handleDragStart: (event: DragStartEvent) => void
  handleDragOver: (event: DragOverEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
}

export function useKanbanDragDrop({
  tasks,
  onReorder,
}: UseKanbanDragDropOptions): UseKanbanDragDropReturn {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const activeTask = activeTaskId
    ? tasks.find((t) => t.id === activeTaskId) ?? null
    : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id))
  }, [])

  const handleDragOver = useCallback(
    (_event: DragOverEvent) => {
      // No-op: we handle movement on drag end
    },
    [],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskId(null)
      const { active, over } = event
      if (!over) return

      const taskId = String(active.id)
      const overId = String(over.id)

      // Determine target status and order
      let targetStatus: TaskStatus
      let targetOrder: number

      // Check if dropped over a column
      const isColumn = [
        'backlog',
        'todo',
        'in-progress',
        'review',
        'done',
      ].includes(overId)

      if (isColumn) {
        targetStatus = overId as TaskStatus
        const columnTasks = tasks
          .filter((t) => t.status === targetStatus && t.id !== taskId)
          .sort((a, b) => a.columnOrder - b.columnOrder)
        targetOrder =
          columnTasks.length > 0
            ? columnTasks[columnTasks.length - 1].columnOrder + 1
            : 0
      } else {
        // Dropped on another task
        const overTask = tasks.find((t) => t.id === overId)
        if (!overTask) return
        targetStatus = overTask.status
        targetOrder = overTask.columnOrder
      }

      const currentTask = tasks.find((t) => t.id === taskId)
      if (!currentTask) return

      // Skip if nothing changed
      if (
        currentTask.status === targetStatus &&
        currentTask.columnOrder === targetOrder
      ) {
        return
      }

      onReorder(taskId, targetStatus, targetOrder)
    },
    [tasks, onReorder],
  )

  const handleDragCancel = useCallback(() => {
    setActiveTaskId(null)
  }, [])

  return {
    activeTaskId,
    activeTask,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
