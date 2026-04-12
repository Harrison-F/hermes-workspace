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
import type { KanbanTask, TaskStatus, TaskVisibility } from './types'
import { COLUMN_LABELS, COLUMNS, VISIBILITY_LABELS } from './types'
import { useKanban, type KanbanInitialData } from './hooks/useKanban'
import { KanbanHeader } from './KanbanHeader'
import { KanbanBoard } from './KanbanBoard'
import { CreateTaskDialog } from './CreateTaskDialog'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { statusPillClasses, visibilityPillClasses } from './tone'

interface ContextMenuItem {
  label: string
  kind: 'default' | 'status' | 'visibility' | 'date' | 'danger' | 'submenu'
  status?: TaskStatus
  visibility?: TaskVisibility
  children?: ContextMenuItem[]
}

interface ContextMenuSection {
  title?: string
  items: ContextMenuItem[]
}

export function formatCompleteByDateInputValue(dueAt?: number): string {
  if (!dueAt) return ''
  return new Date(dueAt).toISOString().slice(0, 10)
}

export function buildTaskContextMenuSections(task: KanbanTask): ContextMenuSection[] {
  const visibilityOptions: TaskVisibility[] = ['yes', 'somewhat', 'no']

  return [
    {
      items: [
        { label: 'Open details', kind: 'default' },
        {
          label: 'Move to',
          kind: 'submenu',
          children: COLUMNS.filter((status) => status !== task.status).map((status) => ({
            label: COLUMN_LABELS[status],
            kind: 'status' as const,
            status,
          })),
        },
        {
          label: 'Visibility',
          kind: 'submenu',
          children: visibilityOptions.map((visibility) => ({
            label: VISIBILITY_LABELS[visibility],
            kind: 'visibility' as const,
            visibility,
          })),
        },
        {
          label: 'Complete By',
          kind: 'submenu',
          children: [{ label: 'Set date', kind: 'date' }],
        },
      ],
    },
    {
      items: [{ label: 'Delete task', kind: 'danger' }],
    },
  ]
}

interface KanbanPanelProps {
  initialData?: KanbanInitialData | null
}

export function KanbanPanel({ initialData }: KanbanPanelProps = {}) {
  const {
    boards,
    activeBoardId,
    setActiveBoardId,
    createBoard,
    updateBoard,
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
  } = useKanban({ initialData })

  // Dialogs & drawers
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogInitialStatus, setCreateDialogInitialStatus] =
    useState<TaskStatus>('todo')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [boardDialogOpen, setBoardDialogOpen] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  // Context menu for moving tasks
  const [contextMenu, setContextMenu] = useState<{
    task: KanbanTask
    x: number
    y: number
    activeSubmenu: string | null
    completeByValue: string
  } | null>(null)

  const handleTaskClick = useCallback((task: KanbanTask) => {
    setSelectedTaskId(task.id)
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
      setContextMenu({
        task,
        x: e.clientX,
        y: e.clientY,
        activeSubmenu: null,
        completeByValue: formatCompleteByDateInputValue(task.dueAt),
      })
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

  const handleSetVisibility = useCallback(
    async (taskId: string, visibility: TaskVisibility) => {
      await updateTask(taskId, { visibility })
      setContextMenu(null)
    },
    [updateTask],
  )

  const handleDeleteFromMenu = useCallback(
    async (taskId: string) => {
      await deleteTask(taskId)
      setContextMenu(null)
      if (selectedTaskId === taskId) {
        setDrawerOpen(false)
        setSelectedTaskId(null)
      }
    },
    [deleteTask, selectedTaskId],
  )

  const handleSetDueDate = useCallback(
    async (taskId: string, value: string) => {
      await updateTask(taskId, { dueAt: value ? new Date(`${value}T12:00:00`).getTime() : null })
      setContextMenu(null)
    },
    [updateTask],
  )

  const activeBoard = boards.find((b) => b.id === activeBoardId)
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null

  const handleRenameColumn = useCallback(
    async (status: TaskStatus, title: string) => {
      if (!activeBoard) return

      await updateBoard(activeBoard.id, {
        config: {
          ...activeBoard.config,
          columns: activeBoard.config.columns.map((column) =>
            column.key === status ? { ...column, title } : column,
          ),
        },
      })
    },
    [activeBoard, updateBoard],
  )

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
            onRenameColumn={handleRenameColumn}
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
          initialVisibility={activeBoard?.config.defaults.visibility ?? 'no'}
          onSubmit={createTask}
        />
      )}

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedTaskId(null)
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

      {/* Context menu for task actions */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            aria-hidden
          />
          <div
            className="fixed z-50 min-w-[220px] rounded-lg border p-1 shadow-lg"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--theme-panel)',
              borderColor: 'var(--theme-border)',
            }}
          >
            {buildTaskContextMenuSections(contextMenu.task).map((section, sectionIndex) => (
              <div key={section.title ?? `section-${sectionIndex}`}>
                {sectionIndex > 0 && (
                  <div
                    className="my-1 border-t"
                    style={{ borderColor: 'var(--theme-border)' }}
                  />
                )}
                {section.title && (
                  <div
                    className="px-2 py-1.5 text-xs font-medium"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    {section.title}
                  </div>
                )}
                {section.items.map((item) => {
                  const showSubmenu =
                    contextMenu.activeSubmenu === item.label && item.children?.length
                  return (
                    <div
                      key={`${section.title ?? 'action'}-${item.label}`}
                      className="relative"
                      onMouseEnter={() => {
                        if (item.kind === 'submenu') {
                          setContextMenu((current) =>
                            current ? { ...current, activeSubmenu: item.label } : current,
                          )
                        }
                      }}
                      onMouseLeave={() => {
                        if (item.kind === 'submenu') {
                          setContextMenu((current) =>
                            current?.activeSubmenu === item.label
                              ? { ...current, activeSubmenu: null }
                              : current,
                          )
                        }
                      }}
                    >
                      {item.kind === 'date' ? (
                        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                          <span className="shrink-0">{item.label}</span>
                          <Input
                            nativeInput
                            type="date"
                            value={contextMenu.completeByValue}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setContextMenu((current) =>
                                current
                                  ? { ...current, completeByValue: e.target.value }
                                  : current,
                              )
                            }
                            onBlur={() => {
                              void handleSetDueDate(
                                contextMenu.task.id,
                                contextMenu.completeByValue,
                              )
                            }}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                              if (e.key === 'Enter') {
                                void handleSetDueDate(
                                  contextMenu.task.id,
                                  contextMenu.completeByValue,
                                )
                              }
                            }}
                            className="h-7 text-[11px]"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.kind === 'default') {
                              setSelectedTaskId(contextMenu.task.id)
                              setDrawerOpen(true)
                              setContextMenu(null)
                              return
                            }
                            if (item.kind === 'status' && item.status) {
                              void handleMoveTask(contextMenu.task.id, item.status)
                              return
                            }
                            if (item.kind === 'visibility' && item.visibility) {
                              void handleSetVisibility(contextMenu.task.id, item.visibility)
                              return
                            }
                            if (item.kind === 'danger') {
                              void handleDeleteFromMenu(contextMenu.task.id)
                              return
                            }
                            if (item.kind === 'submenu') {
                              setContextMenu((current) =>
                                current
                                  ? {
                                      ...current,
                                      activeSubmenu:
                                        current.activeSubmenu === item.label ? null : item.label,
                                    }
                                  : current,
                              )
                            }
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-gray-500/10',
                            item.kind === 'danger' && 'text-red-500',
                          )}
                          style={{
                            color: item.kind === 'danger' ? undefined : 'var(--theme-text)',
                          }}
                        >
                          {item.kind === 'status' && item.status && (
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full',
                                statusPillClasses(item.status).split(' ')[1],
                              )}
                            />
                          )}
                          {item.kind === 'visibility' && item.visibility && (
                            <span
                              className={cn(
                                'inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                visibilityPillClasses(item.visibility),
                              )}
                            >
                              {VISIBILITY_LABELS[item.visibility]}
                            </span>
                          )}
                          <span>{item.label}</span>
                          {item.kind === 'submenu' && <span className="ml-auto">›</span>}
                        </button>
                      )}

                      {showSubmenu && (
                        <div
                          className="absolute left-full top-0 ml-1 min-w-[180px] rounded-lg border p-1 shadow-lg"
                          style={{
                            background: 'var(--theme-panel)',
                            borderColor: 'var(--theme-border)',
                          }}
                        >
                          {item.children?.map((child) =>
                            child.kind === 'date' ? (
                              <div
                                key={`${item.label}-${child.label}`}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                              >
                                <span className="shrink-0">{child.label}</span>
                                <Input
                                  nativeInput
                                  type="date"
                                  value={contextMenu.completeByValue}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setContextMenu((current) =>
                                      current
                                        ? { ...current, completeByValue: e.target.value }
                                        : current,
                                    )
                                  }
                                  onBlur={() => {
                                    void handleSetDueDate(
                                      contextMenu.task.id,
                                      contextMenu.completeByValue,
                                    )
                                  }}
                                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter') {
                                      void handleSetDueDate(
                                        contextMenu.task.id,
                                        contextMenu.completeByValue,
                                      )
                                    }
                                  }}
                                  className="h-7 text-[11px]"
                                />
                              </div>
                            ) : (
                              <button
                                key={`${item.label}-${child.label}`}
                                type="button"
                                onClick={() => {
                                  if (child.kind === 'status' && child.status) {
                                    void handleMoveTask(contextMenu.task.id, child.status)
                                    return
                                  }
                                  if (child.kind === 'visibility' && child.visibility) {
                                    void handleSetVisibility(contextMenu.task.id, child.visibility)
                                  }
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-gray-500/10"
                                style={{ color: 'var(--theme-text)' }}
                              >
                                {child.kind === 'status' && child.status && (
                                  <span
                                    className={cn(
                                      'h-2 w-2 rounded-full',
                                      statusPillClasses(child.status).split(' ')[1],
                                    )}
                                  />
                                )}
                                {child.kind === 'visibility' && child.visibility && (
                                  <span
                                    className={cn(
                                      'inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                                      visibilityPillClasses(child.visibility),
                                    )}
                                  >
                                    {VISIBILITY_LABELS[child.visibility]}
                                  </span>
                                )}
                                <span>{child.label}</span>
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
