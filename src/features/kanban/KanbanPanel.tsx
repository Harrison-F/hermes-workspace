import { useCallback, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import type { KanbanTask, TaskStatus } from './types'
import { COLUMN_LABELS, COLUMNS } from './types'
import { useKanban } from './hooks/useKanban'
import { KanbanHeader } from './KanbanHeader'
import { KanbanBoard } from './KanbanBoard'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { statusPillClasses } from './tone'

export function KanbanPanel() {
  const {
    boards,
    activeBoardId,
    setActiveBoardId,
    createBoard,
    deleteBoard,
    tasks,
    filteredTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTask,
    filters,
    setFilters,
    resetFilters,
    loading,
    error,
  } = useKanban()

  // Dialogs & drawers
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogInitialStatus, setCreateDialogInitialStatus] =
    useState<TaskStatus>('todo')
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [boardDialogOpen, setBoardDialogOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  // Context menu for moving tasks
  const [contextMenu, setContextMenu] = useState<{
    task: KanbanTask
    x: number
    y: number
  } | null>(null)

  const handleTaskClick = useCallback((task: KanbanTask) => {
    setSelectedTask(task)
    setDrawerOpen(true)
  }, [])

  const handleAddTask = useCallback((status: TaskStatus) => {
    setCreateDialogInitialStatus(status)
    setCreateDialogOpen(true)
  }, [])

  const handleCreateBoard = useCallback(async () => {
    if (!newBoardName.trim()) return
    await createBoard(newBoardName.trim())
    setNewBoardName('')
    setBoardDialogOpen(false)
  }, [newBoardName, createBoard])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, task: KanbanTask) => {
      e.preventDefault()
      setContextMenu({ task, x: e.clientX, y: e.clientY })
    },
    [],
  )

  const handleMoveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus) => {
      await updateTask(taskId, { status: newStatus })
      setContextMenu(null)
    },
    [updateTask],
  )

  const activeBoard = boards.find((b) => b.id === activeBoardId)

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          Loading kanban...
        </span>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col"
      onContextMenu={(e) => {
        // Only show context menu on task cards
        const target = e.target as HTMLElement
        const card = target.closest('[data-task-id]')
        if (card) {
          const taskId = card.getAttribute('data-task-id')
          const task = tasks.find((t) => t.id === taskId)
          if (task) handleContextMenu(e, task)
        }
      }}
    >
      {/* Error banner */}
      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Header */}
      <KanbanHeader
        boards={boards}
        activeBoardId={activeBoardId}
        onBoardSelect={setActiveBoardId}
        onCreateBoard={() => setBoardDialogOpen(true)}
        filters={filters}
        onFiltersChange={setFilters}
        onResetFilters={resetFilters}
        onCreateTask={() => setCreateDialogOpen(true)}
      />

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {activeBoardId ? (
          <KanbanBoard
            tasks={filteredTasks}
            config={activeBoard?.config}
            onTaskClick={handleTaskClick}
            onAddTask={handleAddTask}
            onReorder={reorderTask}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
            <p
              className="text-sm"
              style={{ color: 'var(--theme-muted)' }}
            >
              {boards.length === 0
                ? 'No boards yet. Create one to get started.'
                : 'Select a board to view tasks.'}
            </p>
            {boards.length === 0 && (
              <Button onClick={() => setBoardDialogOpen(true)}>
                Create Board
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      {activeBoardId && (
        <CreateTaskDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          boardId={activeBoardId}
          initialStatus={createDialogInitialStatus}
          onSubmit={createTask}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedTask(null)
        }}
        onSave={updateTask}
        onDelete={deleteTask}
      />

      {/* Create Board Dialog */}
      <DialogRoot open={boardDialogOpen} onOpenChange={setBoardDialogOpen}>
        <DialogContent>
          <div className="p-5">
            <DialogTitle>Create Board</DialogTitle>
            <DialogDescription className="mt-1">
              Give your new kanban board a name.
            </DialogDescription>
            <div className="mt-4">
              <Input
                value={newBoardName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewBoardName(e.target.value)
                }
                placeholder="Board name"
                autoFocus
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') handleCreateBoard()
                }}
              />
            </div>
          </div>
          <div
            className="flex items-center justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <DialogClose>Cancel</DialogClose>
            <Button
              onClick={handleCreateBoard}
              disabled={!newBoardName.trim()}
            >
              Create
            </Button>
          </div>
        </DialogContent>
      </DialogRoot>

      {/* Context menu for moving tasks */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            aria-hidden
          />
          <div
            className="fixed z-50 min-w-[160px] rounded-lg border p-1 shadow-lg"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--theme-panel)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div
              className="px-2 py-1.5 text-xs font-medium"
              style={{ color: 'var(--theme-muted)' }}
            >
              Move to...
            </div>
            {COLUMNS.filter((s) => s !== contextMenu.task.status).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleMoveTask(contextMenu.task.id, s)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-gray-500/10',
                  )}
                  style={{ color: 'var(--theme-text)' }}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      statusPillClasses(s).split(' ')[1], // bg class
                    )}
                  />
                  {COLUMN_LABELS[s]}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  )
}
